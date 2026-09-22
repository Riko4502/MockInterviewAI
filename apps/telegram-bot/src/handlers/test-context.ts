import type { Locale } from "@packages/i18n";
import { vi } from "vitest";
import type { TgCommandContext, TgContext } from "../types";

interface ContextOverrides {
  chat?: { id: number; type?: string };
  from?: { language_code?: string } | undefined;
  session?: { locale?: Locale | undefined };
  match?: string;
  callbackQuery?: { data?: string } | undefined;
}

export interface HandlerContextStub {
  ctx: TgContext;
  commandCtx: TgCommandContext;
  reply: ReturnType<typeof vi.fn>;
  answerCallback: ReturnType<typeof vi.fn>;
}

/**
 * Создаёт заглушку контекста grammY для тестов хендлеров.
 *
 * Покрывает поля, которые реально читают хендлеры: `chat`, `from`,
 * `session`, `match`, а также `reply`/`answerCallbackQuery` как vi.fn().
 */
export function stubHandlerContext(
  overrides: ContextOverrides = {},
): HandlerContextStub {
  const reply = vi.fn().mockResolvedValue(undefined);
  const answerCallback = vi.fn().mockResolvedValue(undefined);

  const base = {
    chat: overrides.chat ?? { id: 42, type: "private" },
    from: overrides.from,
    session: { locale: overrides.session?.locale },
    reply,
    answerCallbackQuery: answerCallback,
    match: overrides.match ?? "",
    callbackQuery: overrides.callbackQuery,
  };

  return {
    ctx: base as unknown as TgContext,
    commandCtx: base as unknown as TgCommandContext,
    reply,
    answerCallback,
  };
}
