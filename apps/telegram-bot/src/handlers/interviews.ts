import { InlineKeyboard } from "grammy";
import { ApiError, apiGet } from "../api-client";
import { getProfileLocale, resolveLocale, t } from "../i18n";
import type {
  Locale,
  TelegramInterviewDto,
  TelegramInterviewsListDto,
  TgContext,
} from "../types";

const JOIN_PATH = "/dashboard/sandbox?room=";

function labelOf(locale: Locale, key: string, fallback: string): string {
  const value = t(locale, key);
  return value === key ? fallback : value;
}

function formatItem(locale: Locale, item: TelegramInterviewDto): string {
  const role = labelOf(
    locale,
    `interviews.role.${item.role.toLowerCase()}`,
    item.role,
  );
  const status = labelOf(
    locale,
    `interviews.status.${item.status.toLowerCase()}`,
    item.status,
  );
  const shortId = item.id.replaceAll("-", "").slice(0, 8).toUpperCase();
  return t(locale, "interviews.item", { shortId, role, status });
}

/**
 * Фабрика обработчика `/interviews` (SPEC §11.3).
 *
 * Запрашивает `GET /api/v1/telegram/interviews?chatId=`. Формат строки —
 * `interviews.item`: `Сессия #{{shortId}} — {{role}} ({{status}})`, кнопка
 * `interviews.joinButton` ведёт на `{webAppUrl}/dashboard/sandbox?room={id}`.
 *
 * 404 → `interviews.notLinked`; пустой список → `interviews.empty`;
 * 5xx → `interviews.unexpected`; прочее → `errors.unexpected`.
 *
 * @param webAppUrl - Значение `WEB_APP_URL` из окружения.
 */
export function createInterviewsHandler(webAppUrl: string) {
  return async function interviewsHandler(ctx: TgContext): Promise<void> {
    if (ctx.chat === undefined) return;
    const chatId = String(ctx.chat.id);
    const profileLocale = await getProfileLocale(chatId);

    try {
      const list = await apiGet<TelegramInterviewsListDto>(
        "/telegram/interviews",
        { chatId },
      );

      const locale = resolveLocale(
        ctx.session.locale,
        profileLocale,
        ctx.from?.language_code,
      );

      if (list.items.length === 0) {
        await ctx.reply(t(locale, "interviews.empty"));
        return;
      }

      const lines = [
        t(locale, "interviews.title"),
        ...list.items.map((item) => formatItem(locale, item)),
      ];

      const keyboard = new InlineKeyboard();
      for (const item of list.items) {
        keyboard
          .row()
          .url(
            t(locale, "interviews.joinButton"),
            `${webAppUrl}${JOIN_PATH}${item.id}`,
          );
      }

      await ctx.reply(lines.join("\n"), { reply_markup: keyboard });
    } catch (err) {
      const fallbackLocale = resolveLocale(
        ctx.session.locale,
        profileLocale,
        ctx.from?.language_code,
      );

      if (err instanceof ApiError) {
        if (err.status === 404) {
          await ctx.reply(t(fallbackLocale, "interviews.notLinked"));
          return;
        }
        if (err.status >= 500) {
          await ctx.reply(t(fallbackLocale, "interviews.unexpected"));
          return;
        }
      }
      await ctx.reply(t(fallbackLocale, "errors.unexpected"));
    }
  };
}
