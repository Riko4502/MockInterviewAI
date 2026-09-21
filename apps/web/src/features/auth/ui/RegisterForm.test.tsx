import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initApiTransport, resetApiTransportState } from "@/shared/api";
import { baseFetch } from "@/shared/api/base";
import { paths } from "@/shared/config";
import { RegisterForm } from "./RegisterForm";

const replaceMock = vi.fn();
const startSessionMock = vi.fn();
const registerRequestMock = vi.fn<typeof baseFetch>();

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
  beforeEach(() => {
    resetApiTransportState();
    initApiTransport();
    vi.clearAllMocks();
    registerRequestMock.mockReset();
    registerRequestMock.mockRejectedValue(new Error("Unexpected auth request"));
    vi.mocked(baseFetch).mockReset();
    vi.mocked(baseFetch).mockImplementation((url, options) => {
      if (url === "/api/v1/auth/oauth/providers" && options?.method === "GET") {
        return Promise.resolve({ github: true });
      }
      if (url === "/api/v1/auth/register" && options?.method === "POST") {
        return registerRequestMock(url, options);
      }
      return Promise.reject(
        new Error(`Unexpected request: ${options?.method} ${url}`),
      );
    });
  });

  afterEach(() => {
    resetApiTransportState();
  });

  it("успешный flow: useAuthControllerRegister -> customInstance -> web transport -> baseFetch -> startSession -> redirect", async () => {
    registerRequestMock.mockResolvedValueOnce({
      accessToken: "mock-access-token-register-888",
    });

    renderRegisterForm();

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Пароль");
    const passwordConfirmationInput = screen.getByLabelText(
      "Подтверждение пароля",
    );
    const submitButton = screen.getByRole("button", {
      name: /зарегистрироваться/i,
    });

    fireEvent.change(emailInput, {
      target: { value: "newdeveloper@example.com" },
    });
    fireEvent.change(passwordInput, {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.change(passwordConfirmationInput, {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(registerRequestMock).toHaveBeenCalledTimes(1);
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

    // Проверяем что startSession был вызван с токеном
    await waitFor(() => {
      expect(startSessionMock).toHaveBeenCalledWith(
        "mock-access-token-register-888",
      );
    });

    // Проверяем навигацию через router.replace
    expect(replaceMock).toHaveBeenCalledWith(paths.dashboard);
  });

  it("error path: ошибка API (409 Conflict) в baseFetch пробрасывается в mutation и не сохраняет токен", async () => {
    registerRequestMock.mockRejectedValueOnce(
      new Error("HTTP Error 409: Conflict (Email already exists)"),
    );

    renderRegisterForm();

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Пароль");
    const passwordConfirmationInput = screen.getByLabelText(
      "Подтверждение пароля",
    );
    const submitButton = screen.getByRole("button", {
      name: /зарегистрироваться/i,
    });

    fireEvent.change(emailInput, {
      target: { value: "existing@example.com" },
    });
    fireEvent.change(passwordInput, {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.change(passwordConfirmationInput, {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(registerRequestMock).toHaveBeenCalledTimes(1);
    });

    expect(
      await screen.findByText(
        "HTTP Error 409: Conflict (Email already exists)",
      ),
    ).toBeTruthy();

    // startSession не должен быть вызван
    expect(startSessionMock).not.toHaveBeenCalled();
    // Навигация не должна произойти
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("validation: блокирует отправку и показывает ошибку при пароле ровно 11 символов", async () => {
    renderRegisterForm();

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Пароль");
    const passwordConfirmationInput = screen.getByLabelText(
      "Подтверждение пароля",
    );
    const submitButton = screen.getByRole("button", {
      name: /зарегистрироваться/i,
    });

    fireEvent.change(emailInput, {
      target: { value: "test@example.com" },
    });
    fireEvent.change(passwordInput, {
      target: { value: "12345678901" }, // 11 chars
    });
    fireEvent.change(passwordConfirmationInput, {
      target: { value: "12345678901" },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Пароль должен содержать минимум 12 символов"),
      ).toBeInTheDocument();
    });

    expect(baseFetch).not.toHaveBeenCalledWith(
      "/api/v1/auth/register",
      expect.anything(),
    );
  });

  it("validation: разрешает отправку при пароле ровно 12 символов", async () => {
    registerRequestMock.mockResolvedValueOnce({
      accessToken: "mock-access-token-12-chars",
    });

    renderRegisterForm();

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Пароль");
    const passwordConfirmationInput = screen.getByLabelText(
      "Подтверждение пароля",
    );
    const submitButton = screen.getByRole("button", {
      name: /зарегистрироваться/i,
    });

    fireEvent.change(emailInput, {
      target: { value: "boundary@example.com" },
    });
    fireEvent.change(passwordInput, {
      target: { value: "123456789012" }, // 12 chars
    });
    fireEvent.change(passwordConfirmationInput, {
      target: { value: "123456789012" },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(registerRequestMock).toHaveBeenCalledTimes(1);
    });

    expect(baseFetch).toHaveBeenCalledWith(
      "/api/v1/auth/register",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "boundary@example.com",
          password: "123456789012",
          passwordConfirmation: "123456789012",
        }),
      }),
    );
  });

  it("validation: блокирует отправку при некорректном формате email", async () => {
    renderRegisterForm();

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Пароль");
    const passwordConfirmationInput = screen.getByLabelText(
      "Подтверждение пароля",
    );
    const submitButton = screen.getByRole("button", {
      name: /зарегистрироваться/i,
    });

    fireEvent.change(emailInput, {
      target: { value: "not-an-email" },
    });
    fireEvent.change(passwordInput, {
      target: { value: "Password12345!" },
    });
    fireEvent.change(passwordConfirmationInput, {
      target: { value: "Password12345!" },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Некорректный email")).toBeInTheDocument();
    });

    expect(baseFetch).not.toHaveBeenCalledWith(
      "/api/v1/auth/register",
      expect.anything(),
    );
  });

  it("validation: блокирует отправку при пустом email", async () => {
    renderRegisterForm();

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Пароль");
    const passwordConfirmationInput = screen.getByLabelText(
      "Подтверждение пароля",
    );
    const submitButton = screen.getByRole("button", {
      name: /зарегистрироваться/i,
    });

    fireEvent.change(emailInput, {
      target: { value: "" },
    });
    fireEvent.change(passwordInput, {
      target: { value: "Password12345!" },
    });
    fireEvent.change(passwordConfirmationInput, {
      target: { value: "Password12345!" },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Email обязателен")).toBeInTheDocument();
    });

    expect(baseFetch).not.toHaveBeenCalledWith(
      "/api/v1/auth/register",
      expect.anything(),
    );
  });

  it("validation: блокирует отправку и показывает ошибку при несовпадении паролей", async () => {
    renderRegisterForm();

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Пароль");
    const passwordConfirmationInput = screen.getByLabelText(
      "Подтверждение пароля",
    );
    const submitButton = screen.getByRole("button", {
      name: /зарегистрироваться/i,
    });

    fireEvent.change(emailInput, {
      target: { value: "test@example.com" },
    });
    fireEvent.change(passwordInput, {
      target: { value: "Password12345!" }, // 14 chars >= 12
    });
    fireEvent.change(passwordConfirmationInput, {
      target: { value: "Mismatch12345!" },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Пароли не совпадают")).toBeInTheDocument();
    });

    expect(baseFetch).not.toHaveBeenCalledWith(
      "/api/v1/auth/register",
      expect.anything(),
    );
  });
});
