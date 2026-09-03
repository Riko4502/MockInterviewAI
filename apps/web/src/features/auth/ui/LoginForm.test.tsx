import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initApiTransport, resetApiTransportState } from "@/shared/api";
import { baseFetch } from "@/shared/api/base";
import { LoginForm } from "./LoginForm";

vi.mock("@/shared/api/base", () => ({
  baseFetch: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
      this.name = "AuthError";
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
  const originalLocation = window.location;

  beforeEach(() => {
    resetApiTransportState();
    initApiTransport();
    vi.clearAllMocks();
    sessionStorage.clear();

    // Мокируем window.location.href для проверки навигации в jsdom
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        href: "http://localhost/",
      },
      writable: true,
    });
  });

  afterEach(() => {
    resetApiTransportState();
    sessionStorage.clear();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
      writable: true,
    });
  });

  it("успешный flow: useAuthControllerLogin -> customInstance -> web transport -> baseFetch -> sessionStorage -> redirect", async () => {
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

    // Проверяем сохранение токена в sessionStorage (§28 SPEC.md, CRIT-01)
    await waitFor(() => {
      expect(sessionStorage.getItem("accessToken")).toBe(
        "mock-access-token-login-777",
      );
    });

    // Проверяем навигацию на главную страницу после успешного логина
    expect(window.location.href).toBe("/");
  });

  it("error path: ошибка API в baseFetch пробрасывается в mutation и не сохраняет токен", async () => {
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
    fireEvent.change(passwordInput, { target: { value: "WrongPassword123!" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(baseFetch).toHaveBeenCalledTimes(1);
    });

    // Токен не должен быть сохранён при ошибке
    expect(sessionStorage.getItem("accessToken")).toBeNull();
    // Навигация не должна произойти
    expect(window.location.href).not.toBe("/");
  });
});
