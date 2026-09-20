import { ApiError, apiPost } from "../api-client";
import { resolveLocale, t } from "../i18n";
import type { TelegramUserProfileDto, TgCommandContext } from "../types";

/**
 * Обработчик `/start` (SPEC §11.1).
 *
 * - в не-приватном чате — только приветствие (привязка в группах
 *   не поддерживается);
 * - без токена — приветствие;
 * - с токеном из deep-link `?start=<token>` — привязка через
 *   `POST /api/v1/telegram/link`:
 *   - 200 → привязано (`start.linked`), локаль профиля в сессию;
 *   - 409 → уже привязан;
 *   - 410 → токен истёк;
 *   - 400/401/5xx → ошибка привязки;
 *   - прочее → unexpected.
 */
export async function startHandler(ctx: TgCommandContext): Promise<void> {
  const fallbackLocale = resolveLocale(
    ctx.session.locale,
    undefined,
    ctx.from?.language_code,
  );

  if (ctx.chat.type !== "private") {
    await ctx.reply(t(fallbackLocale, "start.welcome"));
    return;
  }

  const token = ctx.match.trim();
  if (token === "") {
    await ctx.reply(t(fallbackLocale, "start.welcome"));
    return;
  }

  try {
    const profile = await apiPost<TelegramUserProfileDto>("/telegram/link", {
      token,
      chatId: String(ctx.chat.id),
    });

    const locale = resolveLocale(
      ctx.session.locale,
      profile.telegramLocale,
      ctx.from?.language_code,
    );
    ctx.session.locale = locale;
    await ctx.reply(t(locale, "start.linked"));
    await ctx.reply(t(locale, "start.linkedHint"));
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        await ctx.reply(t(fallbackLocale, "start.alreadyLinked"));
        return;
      }
      if (err.status === 410) {
        await ctx.reply(t(fallbackLocale, "start.tokenExpired"));
        return;
      }
      if (err.status === 400 || err.status === 401 || err.status >= 500) {
        await ctx.reply(t(fallbackLocale, "start.linkError"));
        return;
      }
    }
    await ctx.reply(t(fallbackLocale, "errors.unexpected"));
  }
}
