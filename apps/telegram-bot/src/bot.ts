import { Bot, MemorySessionStorage, session } from "grammy";
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
