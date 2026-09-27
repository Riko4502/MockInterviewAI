import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initApiTransport, resetApiTransportState } from "@/shared/api";
import i18n from "@/shared/lib/i18n";
import { TelegramLoginButton } from "./TelegramLoginButton";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  startSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
}));
vi.mock("@/entities/session", () => ({
  useSession: () => ({ startSession: mocks.startSession }),
}));

const WIDGET_SRC = "https://telegram.org/js/telegram-widget.js";

const telegramUser = {
  id: 123456789,
  first_name: "Ivan",
  username: "ivan_dev",
  auth_date: 1_700_000_000,
  hash: "telegram-hash",
};

function renderButton() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <TelegramLoginButton />
    </QueryClientProvider>,
  );
}

function queryWidgetScript() {
  return document.querySelector<HTMLScriptElement>(
    `script[src="${WIDGET_SRC}"]`,
  );
}

function getWidgetScript() {
  const script = queryWidgetScript();
  if (!script) throw new Error("Telegram widget script not found");
  return script;
}

/** Имитирует подтверждение входа пользователем в окне Telegram. */
function authorizeInTelegram() {
  act(() => {
    window.onTelegramAuth?.(telegramUser);
  });
}

describe("TelegramLoginButton", () => {
  beforeEach(async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
    vi.stubEnv("NEXT_PUBLIC_TELEGRAM_BOT_USERNAME", "mock_interview_bot");
    vi.stubGlobal("fetch", vi.fn());
    resetApiTransportState();
    initApiTransport();
    await i18n.changeLanguage("ru");
  });

  afterEach(() => {
    cleanup();
    resetApiTransportState();
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("ничего не рендерит, если не задано имя бота", () => {
    vi.stubEnv("NEXT_PUBLIC_TELEGRAM_BOT_USERNAME", "");

    const { container } = renderButton();

    expect(container).toBeEmptyDOMElement();
    expect(queryWidgetScript()).toBeNull();
  });

  it("асинхронно загружает виджет с именем бота и callback", () => {
    renderButton();

    const script = getWidgetScript();
    expect(script.async).toBe(true);
    expect(script).toHaveAttribute("data-telegram-login", "mock_interview_bot");
    expect(script).toHaveAttribute("data-onauth", "onTelegramAuth(user)");
    expect(window.onTelegramAuth).toBeTypeOf("function");
    expect(
      screen.getByText("Загрузка входа через Telegram..."),
    ).toBeInTheDocument();

    fireEvent.load(script);

    expect(
      screen.queryByText("Загрузка входа через Telegram..."),
    ).not.toBeInTheDocument();
  });

  it("показывает ошибку, если скрипт Telegram не загрузился", () => {
    renderButton();

    fireEvent.error(getWidgetScript());

    expect(
      screen.getByText(
        "Не удалось загрузить виджет Telegram. Обновите страницу.",
      ),
    ).toBeInTheDocument();
  });

  it("входит существующего пользователя и переходит в /dashboard", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        status: "AUTHENTICATED",
        accessToken: "tg-access-token",
      }),
    );
    renderButton();

    authorizeInTelegram();

    await waitFor(() =>
      expect(mocks.startSession).toHaveBeenCalledWith("tg-access-token"),
    );
    expect(mocks.replace).toHaveBeenCalledWith("/dashboard");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/auth/telegram"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(telegramUser),
      }),
    );
  });

  it("для нового пользователя сохраняет onboardingToken и ведёт на ввод email", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        status: "NEED_EMAIL",
        onboardingToken: "onboarding-123",
      }),
    );
    renderButton();

    authorizeInTelegram();

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/register/complete-telegram"),
    );
    expect(sessionStorage.getItem("telegramOnboardingToken")).toBe(
      "onboarding-123",
    );
    expect(mocks.startSession).not.toHaveBeenCalled();
  });

  it("показывает ответ бэкенда, если авторизация отклонена", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json(
        { statusCode: 401, message: "Invalid Telegram signature" },
        { status: 401 },
      ),
    );
    renderButton();

    authorizeInTelegram();

    expect(
      await screen.findByText("Invalid Telegram signature"),
    ).toBeInTheDocument();
    expect(mocks.startSession).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("показывает сетевую ошибку, если сервер недоступен", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));
    renderButton();

    authorizeInTelegram();

    expect(
      await screen.findByText(
        "Нет соединения с сервером. Проверьте интернет и попробуйте снова.",
      ),
    ).toBeInTheDocument();
    expect(mocks.startSession).not.toHaveBeenCalled();
  });

  it("убирает виджет и глобальный callback при размонтировании", () => {
    const { unmount } = renderButton();
    expect(window.onTelegramAuth).toBeDefined();

    unmount();

    expect(window.onTelegramAuth).toBeUndefined();
    expect(queryWidgetScript()).toBeNull();
  });
});
