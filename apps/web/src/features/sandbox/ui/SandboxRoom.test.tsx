import "@testing-library/jest-dom/vitest";
import { ToastProvider } from "@packages/ui";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    sessionsControllerJoinSession: (
      id: string,
      body?: { inviteToken?: string },
    ) => joinSessionMock(id, body),
  };
});

describe("SandboxRoom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authToken.set("mock-token-123");
    mockSearchParams = new URLSearchParams();
    if (typeof window !== "undefined") {
      window.location.hash = "";
    }
  });

  afterEach(() => {
    authToken.clear();
    if (typeof window !== "undefined") {
      window.location.hash = "";
    }
  });

  it("создает новую сессию без токена в URL, если параметр room отсутствует (CWE-598)", async () => {
    createSessionMock.mockResolvedValue({
      sessionId: "new-session-uuid",
      inviteToken: "inv-token-123",
    });

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

  it("присоединяется к сессии по URI-хэшу (#invite=...) и вычищает токен из URL (CWE-598)", async () => {
    mockSearchParams = new URLSearchParams(
      "room=11111111-1111-4111-a111-111111111111",
    );
    window.location.hash = "#invite=inv-token-hash-123";
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    joinSessionMock.mockResolvedValue({
      role: "CANDIDATE",
      inviteToken: "inv-token-hash-123",
    });

    render(
      <ToastProvider>
        <SandboxRoom />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(joinSessionMock).toHaveBeenCalledWith(
        "11111111-1111-4111-a111-111111111111",
        { inviteToken: "inv-token-hash-123" },
      );
      expect(replaceStateSpy).toHaveBeenCalledWith(
        null,
        "",
        "/dashboard/sandbox?room=11111111-1111-4111-a111-111111111111",
      );
      expect(createSessionMock).not.toHaveBeenCalled();
      expect(screen.getByTestId("sandbox-header")).toBeInTheDocument();
    });

    replaceStateSpy.mockRestore();
  });

  it("присоединяется к сессии по обратно-совместимому query-параметру (?invite=...) и вычищает его из URL", async () => {
    mockSearchParams = new URLSearchParams(
      "room=11111111-1111-4111-a111-111111111111&invite=inv-token-123",
    );
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    joinSessionMock.mockResolvedValue({
      role: "CANDIDATE",
      inviteToken: "inv-token-123",
    });

    render(
      <ToastProvider>
        <SandboxRoom />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(joinSessionMock).toHaveBeenCalledWith(
        "11111111-1111-4111-a111-111111111111",
        { inviteToken: "inv-token-123" },
      );
      expect(replaceStateSpy).toHaveBeenCalledWith(
        null,
        "",
        "/dashboard/sandbox?room=11111111-1111-4111-a111-111111111111",
      );
      expect(createSessionMock).not.toHaveBeenCalled();
      expect(screen.getByTestId("sandbox-header")).toBeInTheDocument();
    });

    replaceStateSpy.mockRestore();
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
        { inviteToken: undefined },
      );
      expect(screen.getByTestId("sandbox-error")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Не удалось подключиться к сессии. Возможно, она закрыта или не существует.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText("Session is closed")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Создать новую сессию/i }),
      ).toBeInTheDocument();
    });

    createSessionMock.mockResolvedValueOnce({
      sessionId: "new-created-session-uuid",
    });

    const createBtn = screen.getByRole("button", {
      name: /Создать новую сессию/i,
    });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(createSessionMock).toHaveBeenCalledTimes(1);
      expect(replaceMock).toHaveBeenCalledWith(
        "/dashboard/sandbox?room=new-created-session-uuid",
      );
      expect(screen.getByTestId("sandbox-header")).toBeInTheDocument();
    });
  });

  it("повторяет попытку создания сессии при клике на кнопку после ошибки создания", async () => {
    createSessionMock
      .mockRejectedValueOnce(new Error("Server creation failed"))
      .mockResolvedValueOnce({ sessionId: "retry-session-uuid" });

    render(
      <ToastProvider>
        <SandboxRoom />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(createSessionMock).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("sandbox-error")).toBeInTheDocument();
      expect(
        screen.getByText("Не удалось создать новую сессию."),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Server creation failed"),
      ).not.toBeInTheDocument();
    });

    const createButton = screen.getByRole("button", {
      name: /Создать новую сессию/i,
    });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(createSessionMock).toHaveBeenCalledTimes(2);
      expect(replaceMock).toHaveBeenCalledWith(
        "/dashboard/sandbox?room=retry-session-uuid",
      );
      expect(screen.getByTestId("sandbox-header")).toBeInTheDocument();
      expect(screen.getByTestId("sandbox-task-panel")).toBeInTheDocument();
    });
  });

  it("игнорирует устаревший ответ createSession при размонтировании (cleanup-флаг)", async () => {
    let resolveCreateSession!: (value: unknown) => void;
    createSessionMock.mockReturnValue(
      new Promise((resolve) => {
        resolveCreateSession = resolve;
      }),
    );

    const onSessionReady = vi.fn();
    const { unmount } = render(
      <ToastProvider>
        <SandboxRoom onSessionReady={onSessionReady} />
      </ToastProvider>,
    );

    expect(createSessionMock).toHaveBeenCalledTimes(1);

    // Размонтируем компонент до завершения запроса
    unmount();

    // Завершаем запрос после размонтирования
    resolveCreateSession({
      sessionId: "stale-session-id",
      inviteToken: "stale-token",
    });

    // Даем микротаскам выполниться
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(replaceMock).not.toHaveBeenCalled();
    expect(onSessionReady).not.toHaveBeenCalled();
  });

  it("игнорирует устаревший ответ joinSession при смене URL или размонтировании (cleanup-флаг)", async () => {
    mockSearchParams = new URLSearchParams(
      "room=11111111-1111-4111-a111-111111111111",
    );

    let resolveJoinSession!: (value: unknown) => void;
    joinSessionMock.mockReturnValue(
      new Promise((resolve) => {
        resolveJoinSession = resolve;
      }),
    );

    const onSessionReady = vi.fn();
    const { unmount } = render(
      <ToastProvider>
        <SandboxRoom onSessionReady={onSessionReady} />
      </ToastProvider>,
    );

    expect(joinSessionMock).toHaveBeenCalledWith(
      "11111111-1111-4111-a111-111111111111",
      { inviteToken: undefined },
    );

    // Размонтируем компонент до завершения запроса
    unmount();

    // Завершаем ответ joinSession
    resolveJoinSession({
      role: "CANDIDATE",
      inviteToken: "stale-invite",
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onSessionReady).not.toHaveBeenCalled();
  });
});
