import type { Env } from "../config";
import type { BotHandlers } from "../types";
import { createInterviewsHandler } from "./interviews";
import { langCallbackHandler, langHandler } from "./lang";
import { meHandler } from "./me";
import { startHandler } from "./start";
import { unlinkHandler } from "./unlink";

/**
 * Собирает набор хендлеров из конфигурации окружения.
 *
 * `WEB_APP_URL` используется только обработчиком `/interviews`
 * (кнопки перехода в комнату сессии).
 *
 * @param env - Загруженная конфигурация (SPEC §12.1).
 */
export function createHandlers(env: Env): BotHandlers {
  return {
    start: startHandler,
    me: meHandler,
    interviews: createInterviewsHandler(env.WEB_APP_URL),
    unlink: unlinkHandler,
    lang: langHandler,
    langCallback: langCallbackHandler,
  };
}
