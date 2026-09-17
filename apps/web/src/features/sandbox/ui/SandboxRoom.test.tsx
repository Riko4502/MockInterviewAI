import "@testing-library/jest-dom/vitest";
import { ToastProvider } from "@packages/ui";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authToken } from "@/shared/api";
import { SandboxRoom } from "./SandboxRoom";

const { replaceMock, createSessionMock, joinSessionMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  createSessionMock: vi.fn(),
  joinSessionMock: vi.fn(),
}));
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  usePathname: () => "/dashboard/sandbox",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@packages/editor", () => ({
  CodeEditorLazy: () => <div data-testid="code-editor-lazy" />,
}));

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
  useSandboxMedia: () => ({
    peerCount: 1,
    isCallConnected: false,
    isInCall: false,
    isInviteCopied: false,
    onCopyInvite: vi.fn(),
  }),
}));

vi.mock("../lib/useSandboxRealtime", () => ({
  useSandboxRealtime: () => ({
    collaborators: [],
    otherPeers: [],
    peerCount: 1,
    broadcastCodeUpdate: vi.fn(),
    broadcastCursorMove: vi.fn(),
    broadcastTaskChange: vi.fn(),
    broadcastWebRTCSignal: vi.fn(),
    subscribeWebRTCSignal: vi.fn(() => vi.fn()),
    isConnected: true,
  }),
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

vi.mock("@packages/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@packages/api")>();
  return {
    ...actual,
    sessionsControllerCreateSession: () => createSessionMock(),
    sessionsControllerJoinSession: (id: string) => joinSessionMock(id),
  };
});

describe("SandboxRoom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authToken.set("mock-token-123");
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    authToken.clear();
  });

  it("создает новую сессию, если параметр room отсутствует", async () => {
    createSessionMock.mockResolvedValue({ sessionId: "new-session-uuid" });

    render(
      <ToastProvider>
        <SandboxRoom />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(createSessionMock).toHaveBeenCalledTimes(1);
      expect(replaceMock).toHaveBeenCalledWith(
        "/dashboard/sandbox?room=new-session-uuid",
      );
      expect(screen.getByTestId("sandbox-header")).toBeInTheDocument();
      expect(screen.getByTestId("sandbox-task-panel")).toBeInTheDocument();
      expect(screen.getByTestId("code-editor-lazy")).toBeInTheDocument();
      expect(screen.getByTestId("sandbox-console-panel")).toBeInTheDocument();
      expect(screen.getByTestId("sandbox-video-widget")).toBeInTheDocument();
    });
  });

  it("присоединяется к сессии, если параметр room указан в URL", async () => {
    mockSearchParams = new URLSearchParams(
      "room=11111111-1111-4111-a111-111111111111",
    );
    joinSessionMock.mockResolvedValue({ role: "CANDIDATE" });

    render(
      <ToastProvider>
        <SandboxRoom />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(joinSessionMock).toHaveBeenCalledWith(
        "11111111-1111-4111-a111-111111111111",
      );
      expect(createSessionMock).not.toHaveBeenCalled();
      expect(screen.getByTestId("sandbox-header")).toBeInTheDocument();
    });
  });

  it("отображает ошибку и кнопку создания новой сессии, если присоединение не удалось", async () => {
    mockSearchParams = new URLSearchParams(
      "room=22222222-2222-4222-b222-222222222222",
    );
    joinSessionMock.mockRejectedValue(new Error("Session is closed"));

    render(
      <ToastProvider>
        <SandboxRoom />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(joinSessionMock).toHaveBeenCalledWith(
        "22222222-2222-4222-b222-222222222222",
      );
      expect(screen.getByTestId("sandbox-error")).toBeInTheDocument();
      expect(screen.getByText("Session is closed")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Создать новую сессию/i }),
      ).toBeInTheDocument();
    });
  });
});
