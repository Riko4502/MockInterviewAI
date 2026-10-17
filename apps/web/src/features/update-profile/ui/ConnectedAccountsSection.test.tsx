import "@testing-library/jest-dom/vitest";
import type { UserProfileDto } from "@packages/api";
import { SECURITY_UNLINK_ERROR_CODES } from "@packages/dto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/shared/api";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";
import {
  ConnectedAccountsSection,
  UNLINK_REDIRECT_DELAY_MS,
} from "./ConnectedAccountsSection";

const {
  linkTelegramMutateMock,
  requestTelegramUnlinkMutateMock,
  confirmTelegramUnlinkMutateMock,
  unlinkGithubMutateMock,
  githubUnlinkState,
  toastPushMock,
  clearSessionMock,
  replaceMock,
} = vi.hoisted(() => ({
  linkTelegramMutateMock: vi.fn(),
  requestTelegramUnlinkMutateMock: vi.fn(),
  confirmTelegramUnlinkMutateMock: vi.fn(),
  unlinkGithubMutateMock: vi.fn(),
  githubUnlinkState: { isPending: false },
  toastPushMock: vi.fn(),
  clearSessionMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock("@packages/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@packages/api")>();
  return {
    ...actual,
    useTelegramControllerCreateLinkToken: () => ({
      mutate: linkTelegramMutateMock,
      isPending: false,
    }),
    useAuthControllerOauthProviders: () => ({
      data: { github: true },
      isError: false,
    }),
    useProfileControllerRequestTelegramUnlink: () => ({
      mutate: requestTelegramUnlinkMutateMock,
    }),
    useProfileControllerConfirmTelegramUnlink: () => ({
      mutate: confirmTelegramUnlinkMutateMock,
    }),
    useProfileControllerUnlinkGithub: () => ({
      mutate: unlinkGithubMutateMock,
      isPending: githubUnlinkState.isPending,
    }),
  };
});

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

const baseUser: UserProfileDto = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "dev@example.com",
  displayName: "Иван",
  username: "ivan",
  avatarUrl: null,
  telegramUsername: null,
  telegramLinkVerified: false,
  gitUrl: null,
  githubLinkVerified: false,
  theme: "dark",
  locale: "ru",
  timezone: "Europe/Moscow",
  role: "USER",
  permissions: "0",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const telegramLinkedUser: UserProfileDto = {
  ...baseUser,
  telegramUsername: "testuser",
  telegramLinkVerified: true,
};

const githubLinkedUser: UserProfileDto = {
  ...baseUser,
  gitUrl: "https://github.com/testuser",
  githubLinkVerified: true,
};

/** Ошибка отвязки в форме транспорта: тело `{ code }` + HTTP-статус (D4/F7). */
function unlinkError(code: string, status: number): HttpError {
  return new HttpError("Unlink failed", status, {
    code,
    message: "Unlink failed",
  });
}

/** Успешный ответ на запрос кода отвязки Telegram (D4). */
function mockRequestCodeSuccess(expiresInMs = 10 * 60 * 1000) {
  requestTelegramUnlinkMutateMock.mockImplementation(
    (
      _args: unknown,
      options?: {
        onSuccess?: (res: { sent: boolean; expiresAt: string }) => void;
      },
    ) => {
      options?.onSuccess?.({
        sent: true,
        expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
      });
    },
  );
}

describe("ConnectedAccountsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    githubUnlinkState.isPending = false;
  });

  const renderSection = (user = baseUser) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <ConnectedAccountsSection user={user} />
      </QueryClientProvider>,
    );
  };

  it("отображает статус неподключенных аккаунтов и кнопки привязки", () => {
    renderSection();

    expect(screen.getByText("Telegram")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /привязать telegram/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /подключить github/i }),
    ).toBeInTheDocument();
  });

  it("отображает подключенные аккаунты со статусом и кнопками отвязки", () => {
    renderSection({
      ...baseUser,
      telegramUsername: "testuser",
      telegramLinkVerified: true,
      gitUrl: "https://github.com/testuser",
      githubLinkVerified: true,
    });

    expect(screen.getByText("@testuser")).toBeInTheDocument();
    expect(screen.getByText("https://github.com/testuser")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /отвязать/i })).toHaveLength(
      2,
    );
  });

  it("не считает Telegram подключенным, если telegramLinkVerified равен false, даже при наличии telegramUsername", () => {
    renderSection({
      ...baseUser,
      telegramUsername: "unverified_tg",
      telegramLinkVerified: false,
    });

    expect(
      screen.getByRole("button", { name: /привязать telegram/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/отвязать/i)).not.toBeInTheDocument();
  });

  it("не считает GitHub подключенным, если githubLinkVerified равен false, даже при наличии gitUrl", () => {
    renderSection({
      ...baseUser,
      gitUrl: "https://github.com/unverified_git",
      githubLinkVerified: false,
    });

    expect(
      screen.queryByText("https://github.com/unverified_git"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /подключить github/i }),
    ).toBeInTheDocument();
  });

  it("открывает модалку привязки Telegram при клике на кнопку привязки", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(
      screen.getByRole("button", { name: /привязать telegram/i }),
    );

    expect(
      screen.getByRole("heading", { name: /привязка telegram/i }),
    ).toBeInTheDocument();
  });

  it("содержит ссылку на авторизацию GitHub с параметром action=link", () => {
    renderSection();

    const link = screen.getByRole("link", { name: /подключить github/i });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("/api/v1/auth/github?action=link"),
    );
  });

  it("показывает ошибку, если в URL передан error=github_already_linked", () => {
    window.history.pushState({}, "", "/profile?error=github_already_linked");

    renderSection();

    expect(toastPushMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        title: "Этот аккаунт GitHub уже привязан к другому пользователю.",
      }),
    );

    window.history.pushState({}, "", "/profile");
  });

  it("показывает успех, если в URL передан github=success", () => {
    window.history.pushState({}, "", "/profile?github=success");

    renderSection();

    expect(toastPushMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        title: "GitHub успешно привязан!",
      }),
    );

    window.history.pushState({}, "", "/profile");
  });

  describe("отвязка Telegram", () => {
    it("открывает диалог подтверждения и не вызывает мутацию до подтверждения", async () => {
      const user = userEvent.setup();
      renderSection(telegramLinkedUser);

      await user.click(screen.getByRole("button", { name: "Отвязать" }));

      expect(
        screen.getByRole("heading", { name: "Отвязать Telegram?" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/все активные сессии — включая текущую/i),
      ).toBeInTheDocument();
      expect(requestTelegramUnlinkMutateMock).not.toHaveBeenCalled();
      expect(confirmTelegramUnlinkMutateMock).not.toHaveBeenCalled();
    });

    it("отмена в диалоге закрывает его и не вызывает мутацию отвязки", async () => {
      const user = userEvent.setup();
      renderSection(telegramLinkedUser);

      await user.click(screen.getByRole("button", { name: "Отвязать" }));
      await user.click(screen.getByRole("button", { name: "Отмена" }));

      expect(requestTelegramUnlinkMutateMock).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("heading", { name: "Отвязать Telegram?" }),
      ).not.toBeInTheDocument();
    });

    it("подтверждение запрашивает код и открывает шаг ввода с отсчётом и cooldown", async () => {
      const user = userEvent.setup();
      mockRequestCodeSuccess();
      renderSection(telegramLinkedUser);

      await user.click(screen.getByRole("button", { name: "Отвязать" }));
      await user.click(screen.getByRole("button", { name: "Продолжить" }));

      expect(requestTelegramUnlinkMutateMock).toHaveBeenCalledTimes(1);

      expect(
        await screen.findByRole("heading", { name: "Подтверждение отвязки" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Одноразовый код")).toBeInTheDocument();
      expect(screen.getByText(/Код действует ещё \d+ с/)).toBeInTheDocument();
      expect(
        screen.getByText(/Отправить код повторно через \d+ с/),
      ).toBeInTheDocument();
      // Пока идёт cooldown, кнопка повторной отправки недоступна.
      expect(
        screen.queryByRole("button", { name: "Отправить код повторно" }),
      ).not.toBeInTheDocument();
    });

    it("сабмит кода вызывает подтверждение с телом только { code }", async () => {
      const user = userEvent.setup();
      mockRequestCodeSuccess();
      renderSection(telegramLinkedUser);

      await user.click(screen.getByRole("button", { name: "Отвязать" }));
      await user.click(screen.getByRole("button", { name: "Продолжить" }));

      const codeInput = await screen.findByLabelText("Одноразовый код");
      await user.type(codeInput, "123456");
      await user.click(
        screen.getByRole("button", { name: "Подтвердить отвязку" }),
      );

      expect(confirmTelegramUnlinkMutateMock).toHaveBeenCalledWith(
        { data: { code: "123456" } },
        expect.anything(),
      );
    });

    it("по успеху показывает тост, инвалидирует профиль и уводит на логин (F4)", async () => {
      const user = userEvent.setup();
      mockRequestCodeSuccess();

      let confirmSuccess: (() => void) | undefined;
      confirmTelegramUnlinkMutateMock.mockImplementation(
        (_args: unknown, options?: { onSuccess?: () => void }) => {
          confirmSuccess = options?.onSuccess;
        },
      );

      renderSection(telegramLinkedUser);

      await user.click(screen.getByRole("button", { name: "Отвязать" }));
      await user.click(screen.getByRole("button", { name: "Продолжить" }));
      await user.type(
        await screen.findByLabelText("Одноразовый код"),
        "123456",
      );
      await user.click(
        screen.getByRole("button", { name: "Подтвердить отвязку" }),
      );

      expect(confirmSuccess).toBeDefined();

      vi.useFakeTimers();
      act(() => {
        confirmSuccess?.();
      });

      expect(toastPushMock).toHaveBeenCalledWith({
        status: "success",
        title: "Telegram отвязан.",
      });
      // Редирект отложен, чтобы пользователь успел прочитать тост.
      expect(clearSessionMock).not.toHaveBeenCalled();
      expect(replaceMock).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(UNLINK_REDIRECT_DELAY_MS);
      });

      expect(clearSessionMock).toHaveBeenCalledTimes(1);
      expect(replaceMock).toHaveBeenCalledWith(paths.login);
      vi.useRealTimers();
    });

    it("при INVALID_CODE показывает ошибку и оставляет диалог открытым", async () => {
      const user = userEvent.setup();
      mockRequestCodeSuccess();
      confirmTelegramUnlinkMutateMock.mockImplementation(
        (_args: unknown, options?: { onError?: (error: unknown) => void }) => {
          options?.onError?.(
            unlinkError(SECURITY_UNLINK_ERROR_CODES.INVALID_CODE, 400),
          );
        },
      );

      renderSection(telegramLinkedUser);

      await user.click(screen.getByRole("button", { name: "Отвязать" }));
      await user.click(screen.getByRole("button", { name: "Продолжить" }));
      await user.type(
        await screen.findByLabelText("Одноразовый код"),
        "000000",
      );
      await user.click(
        screen.getByRole("button", { name: "Подтвердить отвязку" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Неверный код. Проверьте сообщение бота и попробуйте снова.",
      );
      expect(
        screen.getByRole("heading", { name: "Подтверждение отвязки" }),
      ).toBeInTheDocument();
      expect(clearSessionMock).not.toHaveBeenCalled();
    });

    it("при CODE_EXPIRED помечает код истёкшим и блокирует подтверждение", async () => {
      const user = userEvent.setup();
      mockRequestCodeSuccess();
      confirmTelegramUnlinkMutateMock.mockImplementation(
        (_args: unknown, options?: { onError?: (error: unknown) => void }) => {
          options?.onError?.(
            unlinkError(SECURITY_UNLINK_ERROR_CODES.CODE_EXPIRED, 410),
          );
        },
      );

      renderSection(telegramLinkedUser);

      await user.click(screen.getByRole("button", { name: "Отвязать" }));
      await user.click(screen.getByRole("button", { name: "Продолжить" }));
      await user.type(
        await screen.findByLabelText("Одноразовый код"),
        "123456",
      );
      await user.click(
        screen.getByRole("button", { name: "Подтвердить отвязку" }),
      );

      expect(
        await screen.findByText(
          "Срок действия кода истёк. Запросите новый код.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Код больше не действует — запросите новый."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Подтвердить отвязку" }),
      ).toBeDisabled();
    });

    it("при ATTEMPTS_EXCEEDED показывает сообщение о лимите попыток", async () => {
      const user = userEvent.setup();
      mockRequestCodeSuccess();
      confirmTelegramUnlinkMutateMock.mockImplementation(
        (_args: unknown, options?: { onError?: (error: unknown) => void }) => {
          options?.onError?.(
            unlinkError(SECURITY_UNLINK_ERROR_CODES.ATTEMPTS_EXCEEDED, 429),
          );
        },
      );

      renderSection(telegramLinkedUser);

      await user.click(screen.getByRole("button", { name: "Отвязать" }));
      await user.click(screen.getByRole("button", { name: "Продолжить" }));
      await user.type(
        await screen.findByLabelText("Одноразовый код"),
        "111111",
      );
      await user.click(
        screen.getByRole("button", { name: "Подтвердить отвязку" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Слишком много попыток. Запросите новый код.",
      );
    });

    it("при ALREADY_UNLINKED показывает сообщение, что аккаунт уже отвязан", async () => {
      const user = userEvent.setup();
      mockRequestCodeSuccess();
      confirmTelegramUnlinkMutateMock.mockImplementation(
        (_args: unknown, options?: { onError?: (error: unknown) => void }) => {
          options?.onError?.(
            unlinkError(SECURITY_UNLINK_ERROR_CODES.ALREADY_UNLINKED, 409),
          );
        },
      );

      renderSection(telegramLinkedUser);

      await user.click(screen.getByRole("button", { name: "Отвязать" }));
      await user.click(screen.getByRole("button", { name: "Продолжить" }));
      await user.type(
        await screen.findByLabelText("Одноразовый код"),
        "123456",
      );
      await user.click(
        screen.getByRole("button", { name: "Подтвердить отвязку" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Telegram уже отвязан.",
      );
    });

    it("при rate limit (429 без кода) показывает сообщение о частых запросах", async () => {
      const user = userEvent.setup();
      requestTelegramUnlinkMutateMock.mockImplementation(
        (_args: unknown, options?: { onError?: (error: unknown) => void }) => {
          options?.onError?.(new HttpError("Too many requests", 429));
        },
      );

      renderSection(telegramLinkedUser);

      await user.click(screen.getByRole("button", { name: "Отвязать" }));
      await user.click(screen.getByRole("button", { name: "Продолжить" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Слишком частые запросы. Подождите минуту и попробуйте снова.",
      );
      expect(requestTelegramUnlinkMutateMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("отвязка GitHub", () => {
    it("открывает диалог подтверждения и не вызывает мутацию до подтверждения", async () => {
      const user = userEvent.setup();
      renderSection(githubLinkedUser);

      await user.click(screen.getByRole("button", { name: "Отвязать" }));

      expect(
        screen.getByRole("heading", { name: "Отвязать GitHub?" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/все активные сессии — включая текущую/i),
      ).toBeInTheDocument();
      expect(unlinkGithubMutateMock).not.toHaveBeenCalled();
    });

    it("отмена в диалоге не вызывает мутацию отвязки", async () => {
      const user = userEvent.setup();
      renderSection(githubLinkedUser);

      await user.click(screen.getByRole("button", { name: "Отвязать" }));
      await user.click(screen.getByRole("button", { name: "Отмена" }));

      expect(unlinkGithubMutateMock).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("heading", { name: "Отвязать GitHub?" }),
      ).not.toBeInTheDocument();
    });

    it("подтверждение вызывает мутацию отвязки GitHub и уводит на логин", async () => {
      const user = userEvent.setup();

      let unlinkSuccess: (() => void) | undefined;
      unlinkGithubMutateMock.mockImplementation(
        (_args: unknown, options?: { onSuccess?: () => void }) => {
          unlinkSuccess = options?.onSuccess;
        },
      );

      renderSection(githubLinkedUser);

      await user.click(screen.getByRole("button", { name: "Отвязать" }));
      await user.click(screen.getByRole("button", { name: "Отвязать GitHub" }));

      expect(unlinkGithubMutateMock).toHaveBeenCalledTimes(1);
      expect(unlinkSuccess).toBeDefined();

      vi.useFakeTimers();
      act(() => {
        unlinkSuccess?.();
      });

      expect(toastPushMock).toHaveBeenCalledWith({
        status: "success",
        title: "GitHub отвязан.",
      });

      act(() => {
        vi.advanceTimersByTime(UNLINK_REDIRECT_DELAY_MS);
      });

      expect(clearSessionMock).toHaveBeenCalledTimes(1);
      expect(replaceMock).toHaveBeenCalledWith(paths.login);
      vi.useRealTimers();
    });

    it("при LAST_AUTH_METHOD показывает сообщение и не закрывает диалог (D9)", async () => {
      const user = userEvent.setup();
      unlinkGithubMutateMock.mockImplementation(
        (_args: unknown, options?: { onError?: (error: unknown) => void }) => {
          options?.onError?.(
            unlinkError(SECURITY_UNLINK_ERROR_CODES.LAST_AUTH_METHOD, 409),
          );
        },
      );

      renderSection(githubLinkedUser);

      await user.click(screen.getByRole("button", { name: "Отвязать" }));
      await user.click(screen.getByRole("button", { name: "Отвязать GitHub" }));

      expect(toastPushMock).toHaveBeenCalledWith({
        status: "error",
        title:
          "Нельзя отвязать последний способ входа. Сначала добавьте пароль или другую привязку.",
      });
      expect(
        screen.getByRole("heading", { name: "Отвязать GitHub?" }),
      ).toBeInTheDocument();
      expect(clearSessionMock).not.toHaveBeenCalled();
    });

    it("блокирует кнопки диалога, пока запрос выполняется", async () => {
      githubUnlinkState.isPending = true;
      const user = userEvent.setup();
      renderSection(githubLinkedUser);

      await user.click(screen.getByRole("button", { name: "Отвязать" }));

      expect(screen.getByRole("button", { name: "Отмена" })).toBeDisabled();
      const confirmButton = screen.getByRole("button", {
        name: "Отвязать GitHub",
      });
      expect(confirmButton).toBeDisabled();
      expect(confirmButton).toHaveAttribute("aria-busy", "true");
    });
  });
});
