import "@testing-library/jest-dom/vitest";
import type { AnyWebSocketEnvelope } from "@packages/dto";
import type { LanguageId } from "@packages/editor";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { baseFetch } from "@/shared/api/base";
import { uint8ArrayToBase64 } from "../lib/RealtimeYjsProvider";
import type { RunResult } from "../model/types";
import { useSandboxStore } from "../model/useSandboxStore";
import { SandboxRoomWorkspace } from "./SandboxRoomWorkspace";

vi.mock("@/shared/api/base", () => ({
  baseFetch: vi.fn(),
}));

// Заглушка для дочерних панелей тулбара и медиа
vi.mock("./SandboxHeader", () => ({
  SandboxHeader: ({ onRunCode }: { onRunCode?: () => void }) => (
    <div data-testid="sandbox-header">
      <button
        type="button"
        data-testid="run-code-button"
        onClick={onRunCode}
        disabled={!onRunCode}
      >
        Run Code
      </button>
    </div>
  ),
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
const mockBroadcastRunResult = vi.fn();
let mockOnRemoteTaskChange:
  | ((taskId: string, lang?: LanguageId) => void)
  | undefined;
let mockOnRemoteRunResult: ((result: RunResult) => void) | undefined;

let mockWsConnected = true;

vi.mock("../lib/useSandboxRealtime", () => ({
  useSandboxRealtime: (
    options: {
      onRemoteTaskChange?: (taskId: string, lang?: LanguageId) => void;
      onRemoteRunResult?: (result: RunResult) => void;
    } = {},
  ) => {
    mockOnRemoteTaskChange = options.onRemoteTaskChange;
    mockOnRemoteRunResult = options.onRemoteRunResult;
    return {
      userId: "user-newcomer-123",
      userName: "Newcomer",
      peerCount: 2,
      otherPeers: [],
      wsConnected: mockWsConnected,
      broadcastTaskChange: vi.fn(),
      broadcastWebRTCSignal: vi.fn(),
      broadcastRunResult: mockBroadcastRunResult,
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
    };
  },
}));

describe("SandboxRoomWorkspace (T028, T032, T034 Integration Tests)", () => {
  const roomId = "session-test-workspace-uuid";

  beforeEach(() => {
    vi.clearAllMocks();
    envelopeListeners = [];
    mockOnRemoteTaskChange = undefined;
    mockOnRemoteRunResult = undefined;
    mockWsConnected = true;
    useSandboxStore.getState().resetStore();
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

  it("T032: isolates code between Task 1 and Task 2 upon task switch without cross-contamination", async () => {
    const props = {
      roomId,
      role: "INTERVIEWER" as const,
      pathname: "/dashboard/sandbox",
    };
    render(<SandboxRoomWorkspace {...props} />);

    // 1. Инициализация Задачи 1 (two-sum:typescript)
    const task1Doc = new Y.Doc();
    task1Doc.getText("monaco").insert(0, "// Solution for Task 1 (Two Sum)\n");
    const task1Update = Y.encodeStateAsUpdate(task1Doc);

    act(() => {
      envelopeListeners.forEach((listener) => {
        listener({
          type: "yjs.init",
          version: 1,
          sessionId: roomId,
          requestId: "init_task1",
          timestamp: new Date().toISOString(),
          payload: {
            taskKey: "two-sum:typescript",
            updates: [uint8ArrayToBase64(task1Update)],
          },
        });
      });
    });

    await waitFor(() => {
      const editor = screen.getByTestId("code-editor-lazy");
      expect(editor.getAttribute("data-ytext")).toContain(
        "// Solution for Task 1 (Two Sum)",
      );
    });

    // 2. Переключение на Задачу 2 (valid-palindrome:typescript)
    act(() => {
      useSandboxStore.getState().setTaskId("valid-palindrome");
    });

    // Инициализация Задачи 2
    const task2Doc = new Y.Doc();
    task2Doc
      .getText("monaco")
      .insert(0, "// Solution for Task 2 (Valid Palindrome)\n");
    const task2Update = Y.encodeStateAsUpdate(task2Doc);

    act(() => {
      envelopeListeners.forEach((listener) => {
        listener({
          type: "yjs.init",
          version: 1,
          sessionId: roomId,
          requestId: "init_task2",
          timestamp: new Date().toISOString(),
          payload: {
            taskKey: "valid-palindrome:typescript",
            updates: [uint8ArrayToBase64(task2Update)],
          },
        });
      });
    });

    await waitFor(() => {
      const editor = screen.getByTestId("code-editor-lazy");
      expect(editor.getAttribute("data-ytext")).toContain(
        "// Solution for Task 2 (Valid Palindrome)",
      );
      expect(editor.getAttribute("data-ytext")).not.toContain("Two Sum");
    });

    // 3. Возврат к Задаче 1
    act(() => {
      useSandboxStore.getState().setTaskId("two-sum");
    });

    await waitFor(() => {
      const editor = screen.getByTestId("code-editor-lazy");
      expect(editor.getAttribute("data-ytext")).toContain(
        "// Solution for Task 1 (Two Sum)",
      );
      expect(editor.getAttribute("data-ytext")).not.toContain(
        "Valid Palindrome",
      );
    });

    task1Doc.destroy();
    task2Doc.destroy();
  });

  it("T032: preserves code without overwriting when switching languages", async () => {
    const props = {
      roomId,
      role: "CANDIDATE" as const,
      pathname: "/dashboard/sandbox",
    };
    render(<SandboxRoomWorkspace {...props} />);

    // 1. Инициализация TypeScript-версии задачи
    const tsDoc = new Y.Doc();
    tsDoc
      .getText("monaco")
      .insert(0, "const twoSum = (nums: number[]): number[] => [];\n");
    const tsUpdate = Y.encodeStateAsUpdate(tsDoc);

    act(() => {
      envelopeListeners.forEach((listener) => {
        listener({
          type: "yjs.init",
          version: 1,
          sessionId: roomId,
          requestId: "init_ts",
          timestamp: new Date().toISOString(),
          payload: {
            taskKey: "two-sum:typescript",
            updates: [uint8ArrayToBase64(tsUpdate)],
          },
        });
      });
    });

    await waitFor(() => {
      const editor = screen.getByTestId("code-editor-lazy");
      expect(editor.getAttribute("data-ytext")).toContain("const twoSum =");
    });

    // 2. Переключение на Python
    act(() => {
      useSandboxStore.getState().setLanguage("python");
    });

    const pyDoc = new Y.Doc();
    pyDoc
      .getText("monaco")
      .insert(0, "def two_sum(nums: list[int]) -> list[int]:\n    return []\n");
    const pyUpdate = Y.encodeStateAsUpdate(pyDoc);

    act(() => {
      envelopeListeners.forEach((listener) => {
        listener({
          type: "yjs.init",
          version: 1,
          sessionId: roomId,
          requestId: "init_py",
          timestamp: new Date().toISOString(),
          payload: {
            taskKey: "two-sum:python",
            updates: [uint8ArrayToBase64(pyUpdate)],
          },
        });
      });
    });

    await waitFor(() => {
      const editor = screen.getByTestId("code-editor-lazy");
      expect(editor.getAttribute("data-ytext")).toContain("def two_sum");
      expect(editor.getAttribute("data-ytext")).not.toContain("const twoSum");
    });

    // 3. Возврат к TypeScript
    act(() => {
      useSandboxStore.getState().setLanguage("typescript");
    });

    await waitFor(() => {
      const editor = screen.getByTestId("code-editor-lazy");
      expect(editor.getAttribute("data-ytext")).toContain("const twoSum =");
      expect(editor.getAttribute("data-ytext")).not.toContain("def two_sum");
    });

    tsDoc.destroy();
    pyDoc.destroy();
  });

  it("T032: handles remote task change and applies seeded starter template via yjs.init", async () => {
    const props = {
      roomId,
      role: "CANDIDATE" as const,
      pathname: "/dashboard/sandbox",
    };
    render(<SandboxRoomWorkspace {...props} />);

    // Удаленный участник переключает задачу через task.switched
    act(() => {
      mockOnRemoteTaskChange?.("valid-palindrome", "python");
    });

    expect(useSandboxStore.getState().currentTaskId).toBe("valid-palindrome");
    expect(useSandboxStore.getState().language).toBe("python");

    // Сервер Go Relay присылает пакет yjs.init с сидированным кодом задачи
    const seededDoc = new Y.Doc();
    seededDoc
      .getText("monaco")
      .insert(
        0,
        "class Solution:\n    def isPalindrome(self, s: str) -> bool:\n        pass",
      );
    const seededUpdate = Y.encodeStateAsUpdate(seededDoc);

    act(() => {
      envelopeListeners.forEach((listener) => {
        listener({
          type: "yjs.init",
          version: 1,
          sessionId: roomId,
          requestId: "init_seeded",
          timestamp: new Date().toISOString(),
          payload: {
            taskKey: "valid-palindrome:python",
            updates: [uint8ArrayToBase64(seededUpdate)],
          },
        });
      });
    });

    await waitFor(() => {
      const editor = screen.getByTestId("code-editor-lazy");
      expect(editor.getAttribute("data-ytext")).toContain("class Solution:");
      expect(editor.getAttribute("data-ytext")).toContain("def isPalindrome");
    });

    seededDoc.destroy();
  });

  describe("T034: Run Code and immutable snapshot execution", () => {
    it("captures immutable code snapshot yText.toString() and does not alter sent payload when typing continues in editor", async () => {
      let resolveRunFetch: (value: RunResult) => void = () => {};
      const runFetchPromise = new Promise<RunResult>((resolve) => {
        resolveRunFetch = resolve;
      });
      vi.mocked(baseFetch).mockReturnValue(runFetchPromise as Promise<unknown>);

      const props = {
        roomId,
        role: "CANDIDATE" as const,
        pathname: "/dashboard/sandbox",
      };
      render(<SandboxRoomWorkspace {...props} />);

      // Инициализируем документ Yjs начальным решением
      const initialDoc = new Y.Doc();
      const initialText = initialDoc.getText("monaco");
      initialText.insert(0, "function solution() {\n  return 42;\n}");
      const initialUpdate = Y.encodeStateAsUpdate(initialDoc);

      act(() => {
        envelopeListeners.forEach((listener) => {
          listener({
            type: "yjs.init",
            version: 1,
            sessionId: roomId,
            requestId: "init_run_code",
            timestamp: new Date().toISOString(),
            payload: {
              taskKey: "two-sum:typescript",
              updates: [uint8ArrayToBase64(initialUpdate)],
            },
          });
        });
      });

      await waitFor(() => {
        const editor = screen.getByTestId("code-editor-lazy");
        expect(editor.getAttribute("data-ytext")).toContain(
          "function solution()",
        );
      });

      // 1. Нажимаем кнопку «Run Code»
      const runBtn = screen.getByTestId("run-code-button");
      act(() => {
        runBtn.click();
      });

      // Проверяем, что состояние перешло в isRunning: true
      expect(useSandboxStore.getState().isRunning).toBe(true);
      expect(baseFetch).toHaveBeenCalledTimes(1);

      // 2. Пока запрос выполняется (in-flight), соавтор или кандидат продолжает ввод в редакторе
      const additionalDoc = new Y.Doc();
      const additionalText = additionalDoc.getText("monaco");
      additionalText.insert(0, "\n// added by peer while tests are running");
      const additionalUpdate = Y.encodeStateAsUpdate(additionalDoc);

      act(() => {
        envelopeListeners.forEach((listener) => {
          listener({
            type: "yjs.update",
            version: 1,
            sessionId: roomId,
            requestId: "req_concurrent_edit",
            timestamp: new Date().toISOString(),
            payload: {
              taskKey: "two-sum:typescript",
              updateId: "peer_update_999",
              data: uint8ArrayToBase64(additionalUpdate),
            },
          });
        });
      });

      // Проверяем, что в редакторе новый текст отобразился
      await waitFor(() => {
        const editor = screen.getByTestId("code-editor-lazy");
        expect(editor.getAttribute("data-ytext")).toContain(
          "added by peer while tests are running",
        );
      });

      // 3. Завершаем выполнение тестов на бэкенде (resolve promise)
      const mockResult = {
        success: true,
        totalTests: 3,
        passedTests: 3,
        results: [
          {
            testCaseId: "tc-1",
            passed: true,
            input: "[2, 7, 11, 15], 9",
            expectedOutput: "[0, 1]",
            actualOutput: "[0, 1]",
            executionTimeMs: 4,
          },
        ],
        logs: ["Test suite passed"],
        totalTimeMs: 12,
      };

      await act(async () => {
        resolveRunFetch(mockResult);
      });

      // 4. Проверяем, что в POST /api/v1/code/run ушел исходный неизменяемый снимок, БЕЗ добавленного соавтором кода
      expect(baseFetch).toHaveBeenCalledWith("/api/v1/code/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: "function solution() {\n  return 42;\n}",
          taskKey: "two-sum:typescript",
          taskId: "two-sum",
          language: "typescript",
        }),
      });

      // 5. Проверяем обновление стора и бродкаст результата
      expect(useSandboxStore.getState().isRunning).toBe(false);
      expect(useSandboxStore.getState().runResult).toEqual(mockResult);
      expect(mockBroadcastRunResult).toHaveBeenCalledWith(mockResult);

      initialDoc.destroy();
      additionalDoc.destroy();
    });

    it("handles code runner API error gracefully, stops spinner, and updates store with fallback result", async () => {
      vi.mocked(baseFetch).mockRejectedValueOnce(
        new Error("Sandbox timeout exceeded"),
      );

      const props = {
        roomId,
        role: "CANDIDATE" as const,
        pathname: "/dashboard/sandbox",
      };
      render(<SandboxRoomWorkspace {...props} />);

      const runBtn = screen.getByTestId("run-code-button");
      await act(async () => {
        runBtn.click();
      });

      expect(useSandboxStore.getState().isRunning).toBe(false);
      const runResult = useSandboxStore.getState().runResult;
      expect(runResult?.success).toBe(false);
      expect(runResult?.logs).toContain("Sandbox timeout exceeded");
      expect(mockBroadcastRunResult).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          logs: ["Sandbox timeout exceeded"],
        }),
      );
    });

    it("syncs runResult received from remote collaborator via realtime callback", () => {
      const props = {
        roomId,
        role: "CANDIDATE" as const,
        pathname: "/dashboard/sandbox",
      };
      render(<SandboxRoomWorkspace {...props} />);

      useSandboxStore.setState({ isRunning: true });

      const remoteResult = {
        success: true,
        totalTests: 5,
        passedTests: 5,
        results: [],
        logs: ["Peer ran tests"],
        totalTimeMs: 25,
      };

      act(() => {
        mockOnRemoteRunResult?.(remoteResult);
      });

      expect(useSandboxStore.getState().isRunning).toBe(false);
      expect(useSandboxStore.getState().runResult).toEqual(remoteResult);
    });

    it("sends active taskKey, taskId and language when switching tasks prior to Run Code", async () => {
      vi.mocked(baseFetch).mockResolvedValueOnce({
        success: true,
        totalTests: 1,
        passedTests: 1,
        results: [],
        logs: [],
        totalTimeMs: 5,
      });

      const props = {
        roomId,
        role: "INTERVIEWER" as const,
        pathname: "/dashboard/sandbox",
      };
      render(<SandboxRoomWorkspace {...props} />);

      // 1. Первичная инициализация текущей задачи
      act(() => {
        envelopeListeners.forEach((listener) => {
          listener({
            type: "yjs.init",
            version: 1,
            sessionId: roomId,
            requestId: "init_initial",
            timestamp: new Date().toISOString(),
            payload: {
              taskKey: "two-sum:typescript",
              updates: [],
            },
          });
        });
      });

      // 2. Переключаем задачу на valid-palindrome и язык на python
      act(() => {
        useSandboxStore.getState().setTaskId("valid-palindrome");
        useSandboxStore.getState().setLanguage("python");
      });

      const pyDoc = new Y.Doc();
      pyDoc
        .getText("monaco")
        .insert(0, "def is_valid(s: str) -> bool:\n    return True");
      const pyUpdate = Y.encodeStateAsUpdate(pyDoc);

      act(() => {
        envelopeListeners.forEach((listener) => {
          listener({
            type: "yjs.init",
            version: 1,
            sessionId: roomId,
            requestId: "init_py",
            timestamp: new Date().toISOString(),
            payload: {
              taskKey: "valid-palindrome:python",
              updates: [uint8ArrayToBase64(pyUpdate)],
            },
          });
        });
      });

      await waitFor(() => {
        const editor = screen.getByTestId("code-editor-lazy");
        expect(editor.getAttribute("data-ytext")).toContain("def is_valid");
      });

      const runBtn = screen.getByTestId("run-code-button");
      await act(async () => {
        runBtn.click();
      });

      expect(baseFetch).toHaveBeenCalledWith("/api/v1/code/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: "def is_valid(s: str) -> bool:\n    return True",
          taskKey: "valid-palindrome:python",
          taskId: "valid-palindrome",
          language: "python",
        }),
      });

      pyDoc.destroy();
    });
  });
});
