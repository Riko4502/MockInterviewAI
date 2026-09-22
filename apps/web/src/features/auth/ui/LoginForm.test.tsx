import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initApiTransport, resetApiTransportState } from "@/shared/api";
import { baseFetch } from "@/shared/api/http/base";
import { paths } from "@/shared/config";
import { LoginForm } from "./LoginForm";

const replaceMock = vi.fn();
const startSessionMock = vi.fn();
const loginRequestMock = vi.fn<typeof baseFetch>();

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

vi.mock("@/shared/api/http/base", () => ({
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
    loginRequestMock.mockReset();
    loginRequestMock.mockRejectedValue(new Error("Unexpected auth request"));
    vi.mocked(baseFetch).mockReset();
    vi.mocked(baseFetch).mockImplementation((url, options) => {
      if (url === "/api/v1/auth/oauth/providers" && options?.method === "GET") {
        return Promise.resolve({ github: true });
      }
      if (url === "/api/v1/auth/login" && options?.method === "POST") {
        return loginRequestMock(url, options);
      }
      return Promise.reject(
        new Error(`Unexpected request: ${options?.method} ${url}`),
      );
    });
  });

  afterEach(() => {
    resetApiTransportState();
  });

  it("успешный flow: useAuthControllerLogin -> customInstance -> web transport -> baseFetch -> startSession -> redirect", async () => {
    loginRequestMock.mockResolvedValueOnce({
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
      expect(loginRequestMock).toHaveBeenCalledTimes(1);
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
    loginRequestMock.mockRejectedValueOnce(
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
      expect(loginRequestMock).toHaveBeenCalledTimes(1);
    });

    expect(
      await screen.findByText("HTTP Error 401: Unauthorized"),
    ).toBeTruthy();

    expect(startSessionMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
