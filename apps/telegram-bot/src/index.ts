import type { Server } from "node:http";
import { createServer } from "node:http";
import { webhookCallback } from "grammy";
import { initApiClient } from "./api-client";
import { createBot } from "./bot";
import { loadConfig, WEBHOOK_PATH } from "./config";
import { createHandlers } from "./handlers";

/**
 * Point входа Telegram-бота (SPEC §5).
 *
 * Bootstrap:
 * - загрузка и валидация окружения (`loadConfig`);
 * - инициализация HTTP-клиента внутреннего API (`initApiClient`);
 * - создание бота с зарегистрированными командами (`createBot`);
 * - режим получения updates по наличию `TELEGRAM_WEBHOOK_URL`:
 *   webhook (prod) либо Long Polling (dev);
 * - graceful shutdown по SIGTERM/SIGINT.
 */
export async function main(): Promise<void> {
  const env = loadConfig();

  initApiClient({
    baseUrl: env.API_INTERNAL_URL,
    internalServiceKey: env.INTERNAL_SERVICE_KEY,
  });

  const bot = createBot(env.TELEGRAM_BOT_TOKEN, createHandlers(env));

  let server: Server | undefined;

  const shutdown = (): void => {
    void bot.stop();
    if (server !== undefined) {
      server.close();
    }
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  if (env.TELEGRAM_WEBHOOK_URL !== undefined) {
    const secret = env.TELEGRAM_WEBHOOK_SECRET as string;

    await bot.api.setWebhook(env.TELEGRAM_WEBHOOK_URL, {
      secret_token: secret,
    });

    const handler = webhookCallback(bot, "http", { secretToken: secret });
    server = createServer((req, res) => {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      if (pathname !== WEBHOOK_PATH) {
        res.writeHead(404);
        res.end();
        return;
      }
      handler(req, res).catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "unknown webhook error";
        console.error(`[telegram-bot] webhook error: ${message}`);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end();
        }
      });
    });

    await new Promise<void>((resolve) => {
      server?.listen(env.TELEGRAM_WEBHOOK_PORT, resolve);
    });

    console.error(
      `[telegram-bot] webhook listening on :${env.TELEGRAM_WEBHOOK_PORT}${WEBHOOK_PATH}`,
    );
  } else {
    await bot.start({ drop_pending_updates: true });
  }
}

main().catch((err: unknown) => {
  const message =
    err instanceof Error ? err.message : "unexpected bootstrap error";
  console.error(`[telegram-bot] fatal: ${message}`);
  process.exit(1);
});
