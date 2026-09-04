import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initApiTransport, resetApiTransportState } from "@/shared/api";
import { baseFetch } from "@/shared/api/base";
import { RegisterForm } from "./RegisterForm";

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

function renderRegisterForm() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <RegisterForm />
    </QueryClientProvider>,
  );
}

describe("RegisterForm Integration Flow (T032)", () => {
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
        href: "http://localhost/register",
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

  it("успешный flow: useAuthControllerRegister -> customInstance -> web transport -> baseFetch -> sessionStorage -> redirect", async () => {
    vi.mocked(baseFetch).mockResolvedValueOnce({
      accessToken: "mock-access-token-register-888",
    });

    renderRegisterForm();

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Пароль");
    const confirmPasswordInput = screen.getByLabelText("Подтверждение пароля");
    const submitButton = screen.getByRole("button", {
      name: /зарегистрироваться/i,
    });

    fireEvent.change(emailInput, {
      target: { value: "newdeveloper@example.com" },
    });
    fireEvent.change(passwordInput, {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.change(confirmPasswordInput, {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(baseFetch).toHaveBeenCalledTimes(1);
    });

    expect(baseFetch).toHaveBeenCalledWith(
      "/api/v1/auth/register",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "newdeveloper@example.com",
          password: "StrongPassword123!",
          passwordConfirmation: "StrongPassword123!",
        }),
      }),
    );

    // Проверяем сохранение access token в sessionStorage (§28 SPEC.md, CRIT-01)
    await waitFor(() => {
      expect(sessionStorage.getItem("accessToken")).toBe(
        "mock-access-token-register-888",
      );
    });

    // Проверяем навигацию на главную страницу после успешной регистрации
    expect(window.location.href).toBe("/");
  });

  it("error path: ошибка API (409 Conflict) в baseFetch пробрасывается в mutation и не сохраняет токен", async () => {
    vi.mocked(baseFetch).mockRejectedValueOnce(
      new Error("HTTP Error 409: Conflict (Email already exists)"),
    );

    renderRegisterForm();

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Пароль");
    const confirmPasswordInput = screen.getByLabelText("Подтверждение пароля");
    const submitButton = screen.getByRole("button", {
      name: /зарегистрироваться/i,
    });

    fireEvent.change(emailInput, {
      target: { value: "existing@example.com" },
    });
    fireEvent.change(passwordInput, {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.change(confirmPasswordInput, {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(baseFetch).toHaveBeenCalledTimes(1);
    });

    // Токен не должен быть сохранён при ошибке регистрации
    expect(sessionStorage.getItem("accessToken")).toBeNull();
    // Навигация не должна произойти
    expect(window.location.href).not.toBe("/");
  });
});
