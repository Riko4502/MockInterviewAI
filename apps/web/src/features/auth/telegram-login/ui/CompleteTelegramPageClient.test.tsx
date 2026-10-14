import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initApiTransport, resetApiTransportState } from "@/shared/api";
import { paths } from "@/shared/config";
import i18n from "@/shared/lib/i18n";
import { CompleteTelegramPageClient } from "./CompleteTelegramPageClient";

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

const TOKEN_KEY = "telegramOnboardingToken";
const ONBOARDING_TOKEN = "onboarding-123";

/** Рендерит обёртку страницы внутри QueryClientProvider, как в приложении. */
function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <CompleteTelegramPageClient />
    </QueryClientProvider>,
  );
}

/** Вводит email и отправляет форму. */
async function submitEmail(email: string) {
  const input = await screen.findByLabelText("Email");
  fireEvent.change(input, { target: { value: email } });

  const form = input.closest("form");
  if (!form) throw new Error("Form not found");
  fireEvent.submit(form);
}

describe("CompleteTelegramPageClient", () => {
  beforeEach(async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
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

  it("без токена предлагает вернуться к регистрации", async () => {
    renderPage();

    expect(
      await screen.findByText("Сессия регистрации истекла"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Вернуться к регистрации" }),
    ).toHaveAttribute("href", "/register");
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("с токеном показывает форму ввода email", async () => {
    sessionStorage.setItem(TOKEN_KEY, ONBOARDING_TOKEN);

    renderPage();

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Завершить регистрацию" }),
    ).toBeInTheDocument();
  });

  it("не отправляет запрос при некорректном email", async () => {
    sessionStorage.setItem(TOKEN_KEY, ONBOARDING_TOKEN);
    renderPage();

    await submitEmail("abc");

    expect(
      await screen.findByText("Некорректный формат email"),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("завершает регистрацию, удаляет токен и переходит в /dashboard", async () => {
    sessionStorage.setItem(TOKEN_KEY, ONBOARDING_TOKEN);
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ accessToken: "tg-access-token" }, { status: 201 }),
    );
    renderPage();

    await submitEmail("user@example.com");

    await waitFor(() =>
      expect(mocks.startSession).toHaveBeenCalledWith("tg-access-token"),
    );
    expect(mocks.replace).toHaveBeenCalledWith(paths.onboarding);
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/auth/telegram/complete"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          onboardingToken: ONBOARDING_TOKEN,
          email: "user@example.com",
        }),
      }),
    );
  });

  it("показывает ответ бэкенда и сохраняет токен для повторной попытки", async () => {
    sessionStorage.setItem(TOKEN_KEY, ONBOARDING_TOKEN);
    vi.mocked(fetch).mockResolvedValue(
      Response.json(
        { statusCode: 409, message: "Email уже используется" },
        { status: 409 },
      ),
    );
    renderPage();

    await submitEmail("user@example.com");

    expect(
      await screen.findByText("Email уже используется"),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe(ONBOARDING_TOKEN);
    expect(mocks.startSession).not.toHaveBeenCalled();
  });

  it("показывает переведённую сетевую ошибку вместо текста браузера", async () => {
    sessionStorage.setItem(TOKEN_KEY, ONBOARDING_TOKEN);
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));
    renderPage();

    await submitEmail("user@example.com");

    expect(
      await screen.findByText(
        "Нет соединения с сервером. Проверьте интернет и попробуйте снова.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Failed to fetch")).not.toBeInTheDocument();
  });
});
