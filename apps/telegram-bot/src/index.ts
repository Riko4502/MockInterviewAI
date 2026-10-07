import type { Server } from "node:http";
import { createServer } from "node:http";
import { webhookCallback } from "grammy";
import { initApiClient } from "./api-client";
import { createBot } from "./bot";
import { loadConfig, WEBHOOK_PATH } from "./config";
import { createHandlers } from "./handlers";
import { PushConsumer } from "./push/push-consumer";

/**
 * Point входа Telegram-бота (SPEC §5).
 *
 * Bootstrap:
 * - загрузка и валидация окружения (`loadConfig`);
 * - инициализация HTTP-клиента внутреннего API (`initApiClient`);
 * - создание бота с зарегистрированными командами (`createBot`);
 * - режим получения updates по наличию `TELEGRAM_WEBHOOK_URL`:
 *   webhook (prod) либо Long Polling (dev);
 * - консьюмер очереди push-уведомлений при заданном `RABBITMQ_URL`
 *   (ADR-004:113): в dev переменной может не быть, тогда бот работает только
 *   с командами;
 * - graceful shutdown по SIGTERM/SIGINT: сначала перестаём принимать сообщения
 *   из очереди, потом останавливаем приём updates.
 */
export async function main(): Promise<void> {
  const env = loadConfig();

  initApiClient({
    baseUrl: env.API_INTERNAL_URL,
    internalServiceKey: env.INTERNAL_SERVICE_KEY,
  });

  const bot = createBot(env.TELEGRAM_BOT_TOKEN, createHandlers(env));

  const push =
    env.RABBITMQ_URL === undefined
      ? undefined
      : new PushConsumer({
          url: env.RABBITMQ_URL,
          queue: env.RABBITMQ_QUEUE_NOTIFICATIONS,
          prefetch: env.RABBITMQ_PREFETCH,
          webAppUrl: env.WEB_APP_URL,
          api: bot.api,
        });

  let server: Server | undefined;

  const shutdown = (): void => {
    // Сигнальный обработчик не может быть async, но завершение процессов
    // инициируем: бот и консьюмер закроют каналы/соединения сами.
    void (async () => {
      await Promise.allSettled([bot.stop(), push?.stop()]);
      if (server !== undefined) {
        await new Promise<void>((resolve) => server?.close(() => resolve()));
      }
    })();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  // Старт консьюмера не блокирует приём команд: недоступный брокер — это
  // задержка push-доставки, а не недоступность бота (ADR-004:140). Важно
  // начать его **до** Long Polling: `bot.start()` возвращает promise, который
  // живёт до остановки бота, и код после него в dev-режиме не выполнился бы.
  await push?.start();

  if (env.TELEGRAM_WEBHOOK_URL !== undefined) {
    const secret = env.TELEGRAM_WEBHOOK_SECRET as string;

    await bot.api.setWebhook(env.TELEGRAM_WEBHOOK_URL, {
      secret_token: secret,
    });

    const handler = webhookCallback(bot, "http", { secretToken: secret });
    server = createServer((req, res) => {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      // Health-check для платформ (Render и др.) пингуют "/" — отвечаем 200.
      if (pathname === "/") {
        res.writeHead(200);
        res.end("ok");
        return;
      }
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
