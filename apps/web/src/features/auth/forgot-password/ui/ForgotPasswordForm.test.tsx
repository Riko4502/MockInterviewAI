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
import i18n from "@/shared/lib/i18n";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { ForgotPasswordSuccess } from "./ForgotPasswordSuccess";

const mutateMock = vi.fn();
let mockIsSuccess = false;
let mockIsPending = false;
let mockIsError = false;

vi.mock("@packages/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useAuthControllerForgotPassword: () => ({
      mutate: mutateMock,
      isSuccess: mockIsSuccess,
      isPending: mockIsPending,
      isError: mockIsError,
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

describe("ForgotPasswordForm & ForgotPasswordSuccess i18n and behavior", () => {
  beforeEach(async () => {
    mockIsSuccess = false;
    mockIsPending = false;
    mockIsError = false;
    mutateMock.mockClear();
    await act(async () => {
      await i18n.changeLanguage("ru");
    });
  });

  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage("ru");
    });
  });

  it("renders in Russian by default", () => {
    renderWithClient(<ForgotPasswordForm />);

    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Отправить ссылку для сброса" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Вернуться ко входу" }),
    ).toBeInTheDocument();
  });

  it("renders localized strings in English when language is changed", async () => {
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    renderWithClient(<ForgotPasswordForm />);

    expect(
      screen.getByRole("button", { name: "Send reset link" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to login" }),
    ).toBeInTheDocument();
  });

  it("submits form data correctly", async () => {
    const user = userEvent.setup();
    renderWithClient(<ForgotPasswordForm />);

    const emailInput = screen.getByPlaceholderText("example@mail.com");
    await user.type(emailInput, "test@example.com");

    const submitBtn = screen.getByRole("button", {
      name: "Отправить ссылку для сброса",
    });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith({
        data: { email: "test@example.com" },
      });
    });
  });

  it("renders error state when request fails", () => {
    mockIsError = true;
    renderWithClient(<ForgotPasswordForm />);

    expect(
      screen.getByText(
        "Не удалось отправить письмо. Проверьте email и попробуйте снова.",
      ),
    ).toBeInTheDocument();
  });

  describe("ForgotPasswordSuccess", () => {
    it("renders success message with email and timer button", () => {
      const onResend = vi.fn();
      renderWithClient(
        <ForgotPasswordSuccess
          email="dev@example.com"
          isResending={false}
          onResend={onResend}
        />,
      );

      expect(
        screen.getByText(/инструкции по восстановлению пароля/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Отправить повторно \(60с\)/i }),
      ).toBeDisabled();
      expect(
        screen.getByRole("link", { name: "Вернуться ко входу" }),
      ).toBeInTheDocument();
    });

    it("renders success message in English", async () => {
      await act(async () => {
        await i18n.changeLanguage("en");
      });
      const onResend = vi.fn();
      renderWithClient(
        <ForgotPasswordSuccess
          email="dev@example.com"
          isResending={false}
          onResend={onResend}
        />,
      );

      expect(
        screen.getByText(/password recovery instructions/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Resend \(60s\)/i }),
      ).toBeDisabled();
      expect(
        screen.getByRole("link", { name: "Back to login" }),
      ).toBeInTheDocument();
    });

    it("enables resend button after countdown expires and handles resend click", () => {
      vi.useFakeTimers();
      const onResend = vi.fn();

      renderWithClient(
        <ForgotPasswordSuccess
          email="dev@example.com"
          isResending={false}
          onResend={onResend}
        />,
      );

      act(() => {
        vi.advanceTimersByTime(60000);
      });

      const resendBtn = screen.getByRole("button", {
        name: "Отправить повторно",
      });
      expect(resendBtn).toBeEnabled();

      fireEvent.click(resendBtn);
      expect(onResend).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });
});
