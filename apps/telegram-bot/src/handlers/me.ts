import { ApiError, apiGet } from "../api-client";
import { resolveLocale, t } from "../i18n";
import type { TelegramUserProfileDto, TgContext } from "../types";

const MISSING = "—";

function formatValue(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return MISSING;
  return value;
}

/**
 * Обработчик `/me` (SPEC §11.2).
 *
 * Запрашивает профиль через `GET /api/v1/telegram/profile?chatId=` и выводит
 * карточку (§11.2 формат):
 *
 * ```
 * Профиль
 * Имя: …
 * Email: …
 * ...
 * ```
 *
 * 404 → `me.notLinked`; 5xx → `errors.apiUnavailable`;
 * прочее → `errors.unexpected`.
 */
export async function meHandler(ctx: TgContext): Promise<void> {
  if (ctx.chat === undefined) return;
  const chatId = String(ctx.chat.id);

  try {
    const profile = await apiGet<TelegramUserProfileDto>("/telegram/profile", {
      chatId,
    });

    const locale = resolveLocale(
      ctx.session.locale,
      profile.telegramLocale,
      ctx.from?.language_code,
    );

    const lines = [
      t(locale, "me.title"),
      `${t(locale, "me.name")}: ${formatValue(profile.displayName)}`,
      `${t(locale, "me.email")}: ${formatValue(profile.email)}`,
      `${t(locale, "me.username")}: ${formatValue(profile.username)}`,
      `${t(locale, "me.telegram")}: ${formatValue(profile.telegramUsername)}`,
      `${t(locale, "me.role")}: ${formatValue(profile.role)}`,
    ];

    await ctx.reply(lines.join("\n"));
  } catch (err) {
    const locale = resolveLocale(
      ctx.session.locale,
      undefined,
      ctx.from?.language_code,
    );

    if (err instanceof ApiError) {
      if (err.status === 404) {
        await ctx.reply(t(locale, "me.notLinked"));
        return;
      }
      if (err.status >= 500) {
        await ctx.reply(t(locale, "errors.apiUnavailable"));
        return;
      }
    }
    await ctx.reply(t(locale, "errors.unexpected"));
  }
}
