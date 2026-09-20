import { ApiError, apiPost } from "../api-client";
import { resolveLocale, t } from "../i18n";
import type { TgContext } from "../types";

/**
 * Обработчик `/unlink` (SPEC §11.4).
 *
 * Отвязывает аккаунт (`POST /api/v1/telegram/unlink`):
 * 200 → `unlink.success`; 404 → `unlink.notLinked`;
 * 5xx → `unlink.unexpected`; прочее → `errors.unexpected`.
 */
export async function unlinkHandler(ctx: TgContext): Promise<void> {
  if (ctx.chat === undefined) return;
  const chatId = String(ctx.chat.id);
  const fallbackLocale = resolveLocale(
    ctx.session.locale,
    undefined,
    ctx.from?.language_code,
  );

  try {
    await apiPost("/telegram/unlink", { chatId });
    await ctx.reply(t(fallbackLocale, "unlink.success"));
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) {
        await ctx.reply(t(fallbackLocale, "unlink.notLinked"));
        return;
      }
      if (err.status >= 500) {
        await ctx.reply(t(fallbackLocale, "unlink.unexpected"));
        return;
      }
    }
    await ctx.reply(t(fallbackLocale, "errors.unexpected"));
  }
}
