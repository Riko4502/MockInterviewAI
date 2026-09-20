import { InlineKeyboard } from "grammy";
import { ApiError, apiPatch } from "../api-client";
import { resolveLocale, t } from "../i18n";
import type { Locale, TgCommandContext, TgContext } from "../types";

const LANG_CALLBACK_PATTERN = /^lang:(ru|en)$/;

async function handleApiError(
  ctx: TgContext,
  locale: Locale,
  err: unknown,
): Promise<void> {
  if (err instanceof ApiError) {
    if (err.status === 404) {
      await ctx.reply(t(locale, "lang.notLinked"));
      return;
    }
    if (err.status >= 500) {
      await ctx.reply(t(locale, "lang.persistError"));
      return;
    }
  }
  await ctx.reply(t(locale, "lang.persistError"));
}

/**
 * Применяет выбранную локаль и сохраняет её через
 * `PATCH /api/v1/telegram/preferences` (SPEC §9.5, §11.5).
 */
async function applyLocale(ctx: TgContext, code: Locale): Promise<void> {
  if (ctx.chat === undefined) return;
  const chatId = String(ctx.chat.id);

  try {
    await apiPatch("/telegram/preferences", { chatId, locale: code });
    ctx.session.locale = code;
    await ctx.reply(
      t(code, code === "ru" ? "lang.changedRu" : "lang.changedEn"),
    );
  } catch (err) {
    const fallbackLocale = resolveLocale(
      ctx.session.locale,
      undefined,
      ctx.from?.language_code,
    );
    await handleApiError(ctx, fallbackLocale, err);
  }
}

/**
 * Обработчик `/lang` (SPEC §11.5).
 *
 * Без аргумента — инлайн-клавиатура выбора локали
 * (callback-данные `lang:ru` / `lang:en`);
 * с аргументом — `/lang ru` или `/lang en` применяется сразу.
 */
export async function langHandler(ctx: TgCommandContext): Promise<void> {
  const arg = ctx.match.trim().toLowerCase();

  if (arg === "ru" || arg === "en") {
    await applyLocale(ctx, arg);
    return;
  }

  const locale = resolveLocale(
    ctx.session.locale,
    undefined,
    ctx.from?.language_code,
  );

  const keyboard = new InlineKeyboard()
    .text(t(locale, "lang.ruLabel"), "lang:ru")
    .text(t(locale, "lang.enLabel"), "lang:en");

  await ctx.reply(t(locale, "lang.select"), { reply_markup: keyboard });
}

/**
 * Обработчик нажатия инлайн-кнопки выбора языка (SPE C §9.5).
 */
export async function langCallbackHandler(ctx: TgContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (data === undefined) return;

  const match = LANG_CALLBACK_PATTERN.exec(data);
  if (match === null) return;
  await applyLocale(ctx, match[1] as Locale);
  await ctx.answerCallbackQuery();
}
