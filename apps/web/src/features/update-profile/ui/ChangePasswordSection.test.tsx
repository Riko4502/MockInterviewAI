import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";
import {
  CHANGE_PASSWORD_REDIRECT_DELAY_MS,
  ChangePasswordSection,
} from "./ChangePasswordSection";

const {
  changePasswordMutateMock,
  changePasswordMutationState,
  toastPushMock,
  clearSessionMock,
  replaceMock,
} = vi.hoisted(() => ({
  changePasswordMutateMock: vi.fn(),
  changePasswordMutationState: {
    isPending: false,
    isError: false,
  },
  toastPushMock: vi.fn(),
  clearSessionMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock("../model/use-profile-mutations", () => ({
  useChangePassword: () => ({
    mutate: changePasswordMutateMock,
    isPending: changePasswordMutationState.isPending,
    isError: changePasswordMutationState.isError,
  }),
}));

vi.mock("@packages/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@packages/ui")>();
  return {
    ...actual,
    useToast: () => ({
      push: toastPushMock,
    }),
  };
});

vi.mock("@/entities/session", () => ({
  useSession: () => ({
    clearSession: clearSessionMock,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: vi.fn(),
  }),
}));

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ChangePasswordSection />
    </QueryClientProvider>,
  );
}

describe("ChangePasswordSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    changePasswordMutationState.isPending = false;
    changePasswordMutationState.isError = false;
  });

  it("рендерит заголовок секции, поля ввода и кнопку отправки", () => {
    renderComponent();

    expect(screen.getByText("Безопасность")).toBeInTheDocument();
    expect(
      screen.getByText("Смена пароля и управление доступом к аккаунту."),
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText("Введите текущий пароль"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Введите новый пароль"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Повторите новый пароль"),
    ).toBeInTheDocument();

    const submitButton = screen.getByRole("button", {
      name: "Обновить пароль",
    });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it("валидирует обязательные поля и минимальную длину нового пароля (12 символов)", async () => {
    const user = userEvent.setup();
    renderComponent();

    const currentPasswordInput = screen.getByPlaceholderText(
      "Введите текущий пароль",
    );
    const newPasswordInput = screen.getByPlaceholderText(
      "Введите новый пароль",
    );
    const confirmPasswordInput = screen.getByPlaceholderText(
      "Повторите новый пароль",
    );
    const submitButton = screen.getByRole("button", {
      name: "Обновить пароль",
    });

    // Вводим короткий новый пароль (< 12 символов)
    await user.type(currentPasswordInput, "OldPassword123!");
    await user.type(newPasswordInput, "Short1!");
    await user.type(confirmPasswordInput, "Short1!");

    expect(submitButton).toBeEnabled();
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Пароль должен содержать минимум 12 символов"),
      ).toBeInTheDocument();
    });
    expect(changePasswordMutateMock).not.toHaveBeenCalled();
  });

  it("валидирует несовпадение подтверждения пароля", async () => {
    const user = userEvent.setup();
    renderComponent();

    const currentPasswordInput = screen.getByPlaceholderText(
      "Введите текущий пароль",
    );
    const newPasswordInput = screen.getByPlaceholderText(
      "Введите новый пароль",
    );
    const confirmPasswordInput = screen.getByPlaceholderText(
      "Повторите новый пароль",
    );
    const submitButton = screen.getByRole("button", {
      name: "Обновить пароль",
    });

    await user.type(currentPasswordInput, "OldPassword123!");
    await user.type(newPasswordInput, "ValidNewPassword123!");
    await user.type(confirmPasswordInput, "MismatchedPassword123!");

    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Пароли не совпадают")).toBeInTheDocument();
    });
    expect(changePasswordMutateMock).not.toHaveBeenCalled();
  });

  it("успешно отправляет данные и показывает toast", async () => {
    const user = userEvent.setup();
    changePasswordMutateMock.mockImplementation(
      (_variables: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      },
    );

    renderComponent();

    const currentPasswordInput = screen.getByPlaceholderText(
      "Введите текущий пароль",
    );
    const newPasswordInput = screen.getByPlaceholderText(
      "Введите новый пароль",
    );
    const confirmPasswordInput = screen.getByPlaceholderText(
      "Повторите новый пароль",
    );
    const submitButton = screen.getByRole("button", {
      name: "Обновить пароль",
    });

    await user.type(currentPasswordInput, "OldPassword123!");
    await user.type(newPasswordInput, "NewSecurePassword123!");
    await user.type(confirmPasswordInput, "NewSecurePassword123!");

    await user.click(submitButton);

    expect(changePasswordMutateMock).toHaveBeenCalledWith(
      {
        data: {
          currentPassword: "OldPassword123!",
          newPassword: "NewSecurePassword123!",
          newPasswordConfirmation: "NewSecurePassword123!",
        },
      },
      expect.any(Object),
    );

    expect(toastPushMock).toHaveBeenCalledWith({
      status: "success",
      title: "Пароль успешно изменён. Выполняется перенаправление...",
    });

    // Форма очищена и отображает текст успеха
    expect(
      screen.getByText(
        "Пароль успешно изменён. Выполняется перенаправление...",
      ),
    ).toBeInTheDocument();
  });

  it("перенаправляет на страницу входа и очищает сессию после задержки при успехе", async () => {
    let successCallback: (() => void) | undefined;
    changePasswordMutateMock.mockImplementation(
      (_variables: unknown, options?: { onSuccess?: () => void }) => {
        successCallback = options?.onSuccess;
      },
    );

    const user = userEvent.setup();
    renderComponent();

    await user.type(
      screen.getByPlaceholderText("Введите текущий пароль"),
      "OldPassword123!",
    );
    await user.type(
      screen.getByPlaceholderText("Введите новый пароль"),
      "NewSecurePassword123!",
    );
    await user.type(
      screen.getByPlaceholderText("Повторите новый пароль"),
      "NewSecurePassword123!",
    );

    await user.click(screen.getByRole("button", { name: "Обновить пароль" }));

    expect(successCallback).toBeDefined();

    vi.useFakeTimers();
    act(() => {
      successCallback?.();
    });

    expect(clearSessionMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(CHANGE_PASSWORD_REDIRECT_DELAY_MS);
    });

    expect(clearSessionMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith(paths.login);
    vi.useRealTimers();
  });

  it("очищает таймер перенаправления при размонтировании компонента", async () => {
    let successCallback: (() => void) | undefined;
    changePasswordMutateMock.mockImplementation(
      (_variables: unknown, options?: { onSuccess?: () => void }) => {
        successCallback = options?.onSuccess;
      },
    );

    const user = userEvent.setup();
    const { unmount } = renderComponent();

    await user.type(
      screen.getByPlaceholderText("Введите текущий пароль"),
      "OldPassword123!",
    );
    await user.type(
      screen.getByPlaceholderText("Введите новый пароль"),
      "NewSecurePassword123!",
    );
    await user.type(
      screen.getByPlaceholderText("Повторите новый пароль"),
      "NewSecurePassword123!",
    );

    await user.click(screen.getByRole("button", { name: "Обновить пароль" }));

    expect(successCallback).toBeDefined();

    vi.useFakeTimers();
    act(() => {
      successCallback?.();
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(CHANGE_PASSWORD_REDIRECT_DELAY_MS);
    });

    expect(clearSessionMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("обрабатывает 401 ошибку (неверный текущий пароль)", async () => {
    const user = userEvent.setup();

    changePasswordMutateMock.mockImplementation(
      (_variables: unknown, options?: { onError?: (err: unknown) => void }) => {
        options?.onError?.({
          status: 401,
          data: { message: "Неверные учётные данные" },
        });
      },
    );

    renderComponent();

    await user.type(
      screen.getByPlaceholderText("Введите текущий пароль"),
      "WrongPassword123!",
    );
    await user.type(
      screen.getByPlaceholderText("Введите новый пароль"),
      "NewSecurePassword123!",
    );
    await user.type(
      screen.getByPlaceholderText("Повторите новый пароль"),
      "NewSecurePassword123!",
    );

    await user.click(screen.getByRole("button", { name: "Обновить пароль" }));

    await waitFor(() => {
      expect(screen.getByText("Неверный текущий пароль")).toBeInTheDocument();
    });
    expect(clearSessionMock).not.toHaveBeenCalled();
  });

  it("обрабатывает 400 ошибку (новый пароль совпадает с текущим)", async () => {
    const user = userEvent.setup();

    changePasswordMutateMock.mockImplementation(
      (_variables: unknown, options?: { onError?: (err: unknown) => void }) => {
        options?.onError?.({
          status: 400,
          data: { message: "Новый пароль должен отличаться от текущего" },
        });
      },
    );

    renderComponent();

    await user.type(
      screen.getByPlaceholderText("Введите текущий пароль"),
      "SamePassword123!",
    );
    await user.type(
      screen.getByPlaceholderText("Введите новый пароль"),
      "SamePassword123!",
    );
    await user.type(
      screen.getByPlaceholderText("Повторите новый пароль"),
      "SamePassword123!",
    );

    await user.click(screen.getByRole("button", { name: "Обновить пароль" }));

    await waitFor(() => {
      expect(
        screen.getByText("Новый пароль должен отличаться от текущего"),
      ).toBeInTheDocument();
    });
    expect(clearSessionMock).not.toHaveBeenCalled();
  });

  it("обрабатывает непредвиденную ошибку сервера", async () => {
    const user = userEvent.setup();

    changePasswordMutateMock.mockImplementation(
      (_variables: unknown, options?: { onError?: (err: unknown) => void }) => {
        options?.onError?.(new Error("Internal server error"));
      },
    );

    renderComponent();

    await user.type(
      screen.getByPlaceholderText("Введите текущий пароль"),
      "ValidPassword123!",
    );
    await user.type(
      screen.getByPlaceholderText("Введите новый пароль"),
      "NewSecurePassword123!",
    );
    await user.type(
      screen.getByPlaceholderText("Повторите новый пароль"),
      "NewSecurePassword123!",
    );

    await user.click(screen.getByRole("button", { name: "Обновить пароль" }));

    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith({
        status: "error",
        title:
          "Не удалось изменить пароль. Проверьте данные и попробуйте снова.",
      });
    });
  });

  it("блокирует поля ввода и кнопку при выполнении запроса", () => {
    changePasswordMutationState.isPending = true;
    renderComponent();

    expect(
      screen.getByPlaceholderText("Введите текущий пароль"),
    ).toBeDisabled();
    expect(screen.getByPlaceholderText("Введите новый пароль")).toBeDisabled();
    expect(
      screen.getByPlaceholderText("Повторите новый пароль"),
    ).toBeDisabled();

    const submitButton = screen.getByRole("button", {
      name: "Обновление...",
    });
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveAttribute("aria-busy", "true");
  });

  it("позволяет переключать видимость пароля через кнопки показать/скрыть", async () => {
    const user = userEvent.setup();
    renderComponent();

    const currentPasswordInput = screen.getByPlaceholderText(
      "Введите текущий пароль",
    );
    expect(currentPasswordInput).toHaveAttribute("type", "password");

    const toggleButtons = screen.getAllByRole("button", {
      name: "Показать пароль",
    });
    expect(toggleButtons.length).toBe(3);

    await user.click(toggleButtons[0]);
    expect(currentPasswordInput).toHaveAttribute("type", "text");

    const hideButton = screen.getByRole("button", {
      name: "Скрыть пароль",
    });
    await user.click(hideButton);
    expect(currentPasswordInput).toHaveAttribute("type", "password");
  });
});
