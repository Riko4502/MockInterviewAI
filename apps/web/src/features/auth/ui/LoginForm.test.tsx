import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initApiTransport, resetApiTransportState } from "@/shared/api";
import { baseFetch } from "@/shared/api/base";
import { paths } from "@/shared/config";
import { LoginForm } from "./LoginForm";

const replaceMock = vi.fn();
const startSessionMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock("@/entities/session", () => ({
  useSession: () => ({
    startSession: startSessionMock,
  }),
}));

vi.mock("@/shared/api/base", () => ({
  baseFetch: vi.fn(),
  HttpError: class HttpError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
      this.name = "HttpError";
    }
  },
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderLoginForm() {
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <LoginForm />
    </QueryClientProvider>,
  );
}

describe("LoginForm Integration Flow (T032)", () => {
  beforeEach(() => {
    resetApiTransportState();
    initApiTransport();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetApiTransportState();
  });

  it("успешный flow: useAuthControllerLogin -> customInstance -> web transport -> baseFetch -> startSession -> redirect", async () => {
    vi.mocked(baseFetch).mockResolvedValueOnce({
      accessToken: "mock-access-token-login-777",
    });

    renderLoginForm();

    const emailInput = screen.getByPlaceholderText("example@mail.com");
    const passwordInput = screen.getByPlaceholderText("Введите пароль");
    const submitButton = screen.getByRole("button", { name: /войти/i });

    fireEvent.change(emailInput, {
      target: { value: "developer@example.com" },
    });

    fireEvent.change(passwordInput, {
      target: { value: "StrongPassword123!" },
    });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(baseFetch).toHaveBeenCalledTimes(1);
    });

    expect(baseFetch).toHaveBeenCalledWith(
      "/api/v1/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "developer@example.com",
          password: "StrongPassword123!",
        }),
      }),
    );

    await waitFor(() => {
      expect(startSessionMock).toHaveBeenCalledWith(
        "mock-access-token-login-777",
      );
    });

    expect(replaceMock).toHaveBeenCalledWith(paths.dashboard);
  });

  it("error path: ошибка API в baseFetch пробрасывается в mutation и не запускает сессию", async () => {
    vi.mocked(baseFetch).mockRejectedValueOnce(
      new Error("HTTP Error 401: Unauthorized"),
    );

    renderLoginForm();

    const emailInput = screen.getByPlaceholderText("example@mail.com");
    const passwordInput = screen.getByPlaceholderText("Введите пароль");
    const submitButton = screen.getByRole("button", { name: /войти/i });

    fireEvent.change(emailInput, {
      target: { value: "developer@example.com" },
    });

    fireEvent.change(passwordInput, {
      target: { value: "WrongPassword123!" },
    });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(baseFetch).toHaveBeenCalledTimes(1);
    });

    expect(startSessionMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
