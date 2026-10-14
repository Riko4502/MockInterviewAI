import { Bot, MemorySessionStorage, session } from "grammy";
import { t } from "./i18n";
import type { BotHandlers, SessionData, TgContext } from "./types";

/**
 * Создаёт и настраивает Telegram-бота (grammY).
 *
 * Подключает in-memory сессию (`MemorySessionStorage`, SPEC §3.3 — одна
 * реплика), регистрирует команды `/start`, `/me`, `/interviews`, `/unlink`,
 * `/lang`, обратный вызов языка `lang:{code}` и глобальный `bot.catch`
 * с логом ошибок без чувствительных данных (SPEC §13).
 *
 * @param token - Токен бота от BotFather (`TELEGRAM_BOT_TOKEN`).
 * @param handlers - Реализации командных хендлеров.
 * @returns Настроенный экземпляр `Bot`.
 */
export function createBot(
  token: string,
  handlers: BotHandlers,
): Bot<TgContext> {
  const bot = new Bot<TgContext>(token);

  bot.use(
    session({
      initial: () => ({ locale: undefined }),
      storage: new MemorySessionStorage<SessionData>(),
    }),
  );

  bot.command("start", handlers.start);
  bot.command("me", handlers.me);
  bot.command("interviews", handlers.interviews);
  bot.command("unlink", handlers.unlink);
  bot.command("lang", handlers.lang);
  bot.callbackQuery(/^lang:(ru|en)$/, handlers.langCallback);

  bot.catch((err) => {
    const message =
      err.error instanceof Error ? err.error.message : String(err.error);
    console.error(`[telegram-bot] unhandled error: ${message}`);
  });

  return bot;
}

/**
 * Регистрирует список команд в системном меню Telegram (кнопка Menu)
 * с поддержкой локализации (ru / en).
 *
 * @param api - Экземпляр Bot["api"].
 */
export async function setupBotCommands(
  api: Bot<TgContext>["api"],
): Promise<void> {
  try {
    // 1. Дефолтные команды (английские)
    await api.setMyCommands([
      { command: "start", description: t("en", "commands.start") },
      { command: "interviews", description: t("en", "commands.interviews") },
      { command: "me", description: t("en", "commands.me") },
      { command: "lang", description: t("en", "commands.lang") },
      { command: "unlink", description: t("en", "commands.unlink") },
    ]);

    // 2. Русскоязычные команды для пользователей с языком приложения 'ru'
    await api.setMyCommands(
      [
        { command: "start", description: t("ru", "commands.start") },
        { command: "interviews", description: t("ru", "commands.interviews") },
        { command: "me", description: t("ru", "commands.me") },
        { command: "lang", description: t("ru", "commands.lang") },
        { command: "unlink", description: t("ru", "commands.unlink") },
      ],
      { language_code: "ru" },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[telegram-bot] failed to register bot commands menu: ${message}`,
    );
  }
}
