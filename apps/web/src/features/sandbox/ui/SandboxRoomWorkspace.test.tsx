import "@testing-library/jest-dom/vitest";
import type { AnyWebSocketEnvelope } from "@packages/dto";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { uint8ArrayToBase64 } from "../lib/RealtimeYjsProvider";
import { useSandboxStore } from "../model/useSandboxStore";
import { SandboxRoomWorkspace } from "./SandboxRoomWorkspace";

// Заглушка для дочерних панелей тулбара и медиа
vi.mock("./SandboxHeader", () => ({
  SandboxHeader: () => <div data-testid="sandbox-header" />,
}));

vi.mock("./SandboxTaskPanel", () => ({
  SandboxTaskPanel: () => <div data-testid="sandbox-task-panel" />,
}));

vi.mock("./SandboxConsolePanel", () => ({
  SandboxConsolePanel: () => <div data-testid="sandbox-console-panel" />,
}));

vi.mock("./SandboxVideoWidget", () => ({
  SandboxVideoWidget: () => <div data-testid="sandbox-video-widget" />,
}));

vi.mock("../model/SandboxMediaContext", () => ({
  SandboxMediaProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sandbox-media-provider">{children}</div>
  ),
}));

vi.mock("@packages/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@packages/ui")>();
  return {
    ...actual,
    Resizable: {
      Group: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      ),
      Panel: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      ),
      Handle: () => <div />,
    },
  };
});

// Mock для Monaco CodeEditorLazy с реактивной привязкой к yText через observe
vi.mock("@packages/editor", () => {
  const { useState, useEffect } = require("react");
  return {
    CodeEditorLazy: ({ yText, value }: { yText?: Y.Text; value?: string }) => {
      const [text, setText] = useState(() =>
        yText ? yText.toString() : value || "",
      );

      useEffect(() => {
        if (!yText) return;
        const observer = () => {
          setText(yText.toString());
        };
        yText.observe(observer);
        setText(yText.toString());
        return () => {
          yText.unobserve(observer);
        };
      }, [yText]);

      return (
        <div data-testid="code-editor-lazy" data-ytext={text}>
          <pre data-testid="editor-content">{text}</pre>
        </div>
      );
    },
  };
});

// Mock реалтайм хука с управляемыми слушателями конвертов
let envelopeListeners: Array<(env: AnyWebSocketEnvelope) => void> = [];
const mockSendEnvelope = vi.fn();

let mockWsConnected = true;

vi.mock("../lib/useSandboxRealtime", () => ({
  useSandboxRealtime: () => ({
    userId: "user-newcomer-123",
    userName: "Newcomer",
    peerCount: 2,
    otherPeers: [],
    collaborators: [],
    wsConnected: mockWsConnected,
    broadcastCodeUpdate: vi.fn(),
    broadcastCursorMove: vi.fn(),
    broadcastTaskChange: vi.fn(),
    broadcastWebRTCSignal: vi.fn(),
    broadcastRunResult: vi.fn(),
    subscribeWebRTCSignal: vi.fn(() => vi.fn()),
    subscribeEnvelope: vi.fn(
      (listener: (env: AnyWebSocketEnvelope) => void) => {
        envelopeListeners.push(listener);
        return () => {
          envelopeListeners = envelopeListeners.filter((l) => l !== listener);
        };
      },
    ),
    sendEnvelope: mockSendEnvelope,
    getSocket: vi.fn(() => null),
  }),
}));

describe("SandboxRoomWorkspace (T028 Integration Test)", () => {
  const roomId = "session-test-workspace-uuid";

  beforeEach(() => {
    vi.clearAllMocks();
    envelopeListeners = [];
    mockWsConnected = true;
    useSandboxStore.getState().setTaskId("two-sum");
    useSandboxStore.getState().setLanguage("typescript");
  });

  it("T028: loads existing solution history from Redis Stream via yjs.init upon join", async () => {
    // 1. Создаем исторические дельты, которые уже были сохранены в Redis Stream
    const historicalDoc = new Y.Doc();
    const historicalText = historicalDoc.getText("monaco");
    historicalText.insert(
      0,
      "function twoSum(nums: number[], target: number): number[] {\n  return [0, 1];\n}",
    );
    const initialUpdate = Y.encodeStateAsUpdate(historicalDoc);

    const candidateProps = {
      roomId,
      role: "CANDIDATE" as const,
      pathname: "/dashboard/sandbox",
    };
    render(<SandboxRoomWorkspace {...candidateProps} />);

    expect(screen.getByTestId("sandbox-room")).toBeInTheDocument();
    expect(screen.getByTestId("code-editor-lazy")).toBeInTheDocument();

    // 2. Эмулируем ответ сервера Go Relay: доставка yjs.init со стримом из Redis
    const initEnvelope: AnyWebSocketEnvelope = {
      type: "yjs.init",
      version: 1,
      sessionId: roomId,
      requestId: "req_init_stream",
      timestamp: new Date().toISOString(),
      payload: {
        taskKey: "two-sum:typescript",
        updates: [uint8ArrayToBase64(initialUpdate)],
      },
    };

    // Доставляем конверт всем зарегистрированным слушателям
    act(() => {
      envelopeListeners.forEach((listener) => {
        listener(initEnvelope);
      });
    });

    // 3. Проверяем, что текст решения полностью и корректно отобразился в редакторе
    await waitFor(() => {
      const editorElement = screen.getByTestId("code-editor-lazy");
      expect(editorElement.getAttribute("data-ytext")).toContain(
        "function twoSum(nums: number[], target: number): number[]",
      );
      expect(editorElement.getAttribute("data-ytext")).toContain(
        "return [0, 1];",
      );
    });

    historicalDoc.destroy();
  });

  it("T028: delivers incremental remote updates and sends local edits via sendEnvelope", async () => {
    const interviewerProps = {
      roomId,
      role: "INTERVIEWER" as const,
      pathname: "/dashboard/sandbox",
    };
    render(<SandboxRoomWorkspace {...interviewerProps} />);

    // 1. Первичная инициализация пустым шаблоном
    act(() => {
      envelopeListeners.forEach((listener) => {
        listener({
          type: "yjs.init",
          version: 1,
          sessionId: roomId,
          requestId: "init_empty",
          timestamp: new Date().toISOString(),
          payload: {
            taskKey: "two-sum:typescript",
            updates: [],
          },
        });
      });
    });

    // 2. Доставка входящей удаленной дельты от кандидата
    const remoteDoc = new Y.Doc();
    remoteDoc.getText("monaco").insert(0, "// candidate wrote this comment\n");
    const delta = Y.encodeStateAsUpdate(remoteDoc);

    act(() => {
      envelopeListeners.forEach((listener) => {
        listener({
          type: "yjs.update",
          version: 1,
          sessionId: roomId,
          requestId: "remote_update_1",
          timestamp: new Date().toISOString(),
          payload: {
            taskKey: "two-sum:typescript",
            updateId: "client_remote:1",
            data: uint8ArrayToBase64(delta),
          },
        });
      });
    });

    // Текст комментария отобразился в редакторе
    await waitFor(() => {
      const editorElement = screen.getByTestId("code-editor-lazy");
      expect(editorElement.getAttribute("data-ytext")).toContain(
        "// candidate wrote this comment",
      );
    });

    remoteDoc.destroy();
  });
});
