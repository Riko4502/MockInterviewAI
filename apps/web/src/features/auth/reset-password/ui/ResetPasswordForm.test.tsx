import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/shared/api";
import i18n from "@/shared/lib/i18n";
import { InvalidTokenAlert } from "./InvalidTokenAlert";
import { ResetPasswordForm } from "./ResetPasswordForm";

const pushMock = vi.fn();
const mutateMock = vi.fn();
let mockIsSuccess = false;
let mockIsPending = false;
let mockIsError = false;
let mockError: unknown = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@packages/ui", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@packages/ui");
  return {
    ...actual,
    useToast: () => ({
      push: vi.fn(),
    }),
  };
});

vi.mock("@packages/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useAuthControllerResetPassword: () => ({
      mutate: mutateMock,
      isSuccess: mockIsSuccess,
      isPending: mockIsPending,
      isError: mockIsError,
      error: mockError,
    }),
  };
});

function renderWithClient(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("ResetPasswordForm & InvalidTokenAlert i18n and behavior", () => {
  beforeEach(async () => {
    mockIsSuccess = false;
    mockIsPending = false;
    mockIsError = false;
    mockError = null;
    mutateMock.mockClear();
    pushMock.mockClear();
    await act(async () => {
      await i18n.changeLanguage("ru");
    });
  });

  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage("ru");
    });
  });

  it("renders form in Russian by default", () => {
    renderWithClient(<ResetPasswordForm token="valid-token-123" />);

    expect(screen.getByText("Новый пароль")).toBeInTheDocument();
    expect(screen.getByText("Минимум 12 символов")).toBeInTheDocument();
    expect(screen.getByText("Подтверждение пароля")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Сохранить новый пароль" }),
    ).toBeInTheDocument();
  });

  it("renders form in English when language is changed", async () => {
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    renderWithClient(<ResetPasswordForm token="valid-token-123" />);

    expect(screen.getByText("New Password")).toBeInTheDocument();
    expect(screen.getByText("Minimum 12 characters")).toBeInTheDocument();
    expect(screen.getByText("Confirm Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save new password" }),
    ).toBeInTheDocument();
  });

  it("toggles password visibility with localized aria labels for both fields", async () => {
    renderWithClient(<ResetPasswordForm token="valid-token-123" />);

    const showButtons = screen.getAllByRole("button", {
      name: "Показать пароль",
    });
    expect(showButtons).toHaveLength(2);

    // Переключаем первое поле пароля
    fireEvent.click(showButtons[0]);
    expect(
      screen.getByRole("button", { name: "Скрыть пароль" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Показать пароль" }),
    ).toBeInTheDocument();

    // Переключаем второе поле пароля
    fireEvent.click(showButtons[1]);
    expect(
      screen.getAllByRole("button", { name: "Скрыть пароль" }),
    ).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Показать пароль" }),
    ).not.toBeInTheDocument();

    // Переключаем оба поля обратно
    const hideButtons = screen.getAllByRole("button", {
      name: "Скрыть пароль",
    });
    fireEvent.click(hideButtons[0]);
    fireEvent.click(hideButtons[1]);

    expect(
      screen.getAllByRole("button", { name: "Показать пароль" }),
    ).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Скрыть пароль" }),
    ).not.toBeInTheDocument();
  });

  it("submits valid passwords correctly", async () => {
    const user = userEvent.setup();
    renderWithClient(<ResetPasswordForm token="valid-token-123" />);

    const inputs = screen.getAllByPlaceholderText(/новый пароль/i);
    await user.type(inputs[0], "superSecretPassword123!");
    await user.type(inputs[1], "superSecretPassword123!");

    const submitBtn = screen.getByRole("button", {
      name: "Сохранить новый пароль",
    });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith({
        data: {
          token: "valid-token-123",
          newPassword: "superSecretPassword123!",
          newPasswordConfirmation: "superSecretPassword123!",
        },
      });
    });
  });

  it("redirects to login after timeout on success", () => {
    vi.useFakeTimers();
    mockIsSuccess = true;

    renderWithClient(<ResetPasswordForm token="valid-token-123" />);

    expect(pushMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(pushMock).toHaveBeenCalledWith("/login");
    vi.useRealTimers();
  });

  it("clears redirect timer on unmount and does not navigate", () => {
    vi.useFakeTimers();
    mockIsSuccess = true;

    const { unmount } = renderWithClient(
      <ResetPasswordForm token="valid-token-123" />,
    );

    unmount();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(pushMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("shows InvalidTokenAlert only when error code is INVALID_RESET_TOKEN", () => {
    mockIsError = true;
    mockError = new HttpError("Invalid token", 400, {
      code: "INVALID_RESET_TOKEN",
      message: "Недействительный или истекший токен сброса пароля",
    });

    renderWithClient(<ResetPasswordForm token="invalid-token" />);

    expect(screen.getByText("Срок действия ссылки истек")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Запросить сброс пароля" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Сохранить новый пароль" }),
    ).not.toBeInTheDocument();
  });

  it("keeps form visible when 400 is a validation error, allowing password correction", () => {
    mockIsError = true;
    mockError = new HttpError("Validation failed", 400, {
      newPassword: "Пароль должен содержать минимум 12 символов",
    });

    renderWithClient(<ResetPasswordForm token="valid-token" />);

    expect(
      screen.queryByText("Срок действия ссылки истек"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Сохранить новый пароль" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Пароль должен содержать минимум 12 символов"),
    ).toBeInTheDocument();
  });

  describe("InvalidTokenAlert", () => {
    it("renders default invalid token alert in Russian", () => {
      renderWithClient(<InvalidTokenAlert />);

      expect(
        screen.getByText("Срок действия ссылки истек"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Запросить сброс пароля" }),
      ).toBeInTheDocument();
    });

    it("renders localized invalid token alert in English", async () => {
      await act(async () => {
        await i18n.changeLanguage("en");
      });
      renderWithClient(<InvalidTokenAlert />);

      expect(screen.getByText("This link has expired")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Request password reset" }),
      ).toBeInTheDocument();
    });
  });
});
