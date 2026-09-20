import type { Locale } from "@packages/i18n";
import type { CommandContext, Context, SessionFlavor } from "grammy";

// Экспорт через `packages/i18n`: `Locale` — `"ru" | "en"`.
export type { Locale };

// Типы ответов внутреннего API переиспользуются из `@packages/dto`
// (без дублирования). Импортируем только types: runtime-значения dto не
// тащим — бот работает через `tsx` без сборки, валидацию выполняет API.
export type {
  LinkRequest,
  LinkTokenResponse,
  TelegramInterviewDto,
  TelegramInterviewsListDto,
  TelegramInterviewsQuery,
  TelegramPreferencesPatch,
  TelegramProfileQuery,
  TelegramUserProfileDto,
  UnlinkRequest,
  UnlinkResponse,
} from "@packages/dto";

/**
 * Данные in-memory сессии грамми (v1: одна реплика, SPEC §3.3).
 *
 * `locale` — transient-локаль, заданная пользователем через `/lang`.
 * Сбрасывается при рестарте процесса (не персистентная локаль).
 */
export interface SessionData {
  locale?: Locale;
}

export type TgContext = Context & SessionFlavor<SessionData>;

/** Контекст команды (значит всё в `/start <payload>`). */
export type TgCommandContext = TgContext & CommandContext<TgContext>;

/**
 * Набор обработчиков команд, регистрируемых в `createBot`.
 *
 * Вынесен в отдельный интерфейс, чтобы ядро бота (`bot.ts`) не зависело
 * от реализаций хендлеров (тестируется с мок-хендлерами, SPEC §14.2).
 */
export interface BotHandlers {
  start: (ctx: TgCommandContext) => void | Promise<void>;
  me: (ctx: TgContext) => void | Promise<void>;
  interviews: (ctx: TgContext) => void | Promise<void>;
  unlink: (ctx: TgContext) => void | Promise<void>;
  lang: (ctx: TgCommandContext) => void | Promise<void>;
  langCallback: (ctx: TgContext) => void | Promise<void>;
}
