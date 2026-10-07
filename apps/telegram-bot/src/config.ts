import { z } from "zod";

export const WEBHOOK_PATH = "/telegram/webhook";

/**
 * Разрешает HTTP только для локальной разработки (`localhost`, `127.0.0.1`,
 * `::1`). Для остальных хостов требуется HTTPS: `API_INTERNAL_URL` получает
 * `INTERNAL_SERVICE_KEY` в заголовке `X-Internal-Service-Key`, и передача ключа
 * по открытому HTTP вне локальной сети раскрывает его наблюдателю (CWE-319).
 */
function isLocalhost(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return (
      hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
    );
  } catch {
    return false;
  }
}

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN обязателен"),
  TELEGRAM_BOT_USERNAME: z.string().min(1).default("MockInterviewBot"),
  API_INTERNAL_URL: z
    .string()
    .url()
    .default("http://localhost:3001/api/v1")
    .superRefine((url, ctx) => {
      if (url.startsWith("http://") && !isLocalhost(url)) {
        ctx.addIssue({
          code: "custom",
          message:
            "API_INTERNAL_URL: HTTP разрешён только для localhost (dev); для остальных хостов требуется HTTPS",
        });
      }
    }),
  INTERNAL_SERVICE_KEY: z
    .string()
    .min(32, "INTERNAL_SERVICE_KEY должен содержать минимум 32 символа"),
  WEB_APP_URL: z.string().url().default("http://localhost:3000"),
  TELEGRAM_WEBHOOK_URL: z
    .string()
    .url()
    .refine((url) => new URL(url).protocol === "https:", {
      message: "TELEGRAM_WEBHOOK_URL должен использовать HTTPS",
    })
    .refine((url) => new URL(url).pathname === WEBHOOK_PATH, {
      message: `TELEGRAM_WEBHOOK_URL должен использовать путь ${WEBHOOK_PATH}`,
    })
    .optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1).optional(),
  // В проде (Render) порт прослушивания webhook-сервера берётся из $PORT,
  // который платформа инжектит в process.env; локально — 8443 (SPEC §12.1).
  TELEGRAM_WEBHOOK_PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(() => Number(process.env.PORT ?? 8443)),
  // Push-консьюмер очереди уведомлений (ADR-004:113). В dev переменная
  // необязательна, чтобы бот поднимался без брокера; в проде отсутствие
  // RABBITMQ_URL означало бы, что push-доставка молча выключена.
  RABBITMQ_URL: z
    .string()
    .refine((value) => {
      try {
        const { protocol } = new URL(value);
        return protocol === "amqp:" || protocol === "amqps:";
      } catch {
        return false;
      }
    }, "RABBITMQ_URL должен быть корректным amqp(s)-URL")
    .optional(),
  RABBITMQ_QUEUE_NOTIFICATIONS: z
    .string()
    .min(1)
    .default("telegram.notifications"),
  // Сколько сообщений берётся из очереди без ack. Небольшое значение держит
  // в памяти одну реплику бота: при prefetch больше десятка ретраи occupy
  // канал и не дают доставить остальные сообщения.
  RABBITMQ_PREFETCH: z.coerce.number().int().positive().default(10),
  NODE_ENV: z.string().min(1).default("development"),
});

export type Env = z.infer<typeof envSchema>;

function toOptional(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Парсит и валидирует переменные окружения (SPEC §12.1).
 *
 * Пустые строки в необязательных переменных (`TELEGRAM_WEBHOOK_URL`,
 * `TELEGRAM_WEBHOOK_SECRET`) интерпретируются как отсутствующие — так
 * `dev`-окружение молча переключается на Long Polling.
 *
 * @param raw - Исходные переменные окружения.
 * @throws Ошибка с перечнем проблем при невалидной конфигурации.
 */
export function loadConfig(raw: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse({
    ...raw,
    TELEGRAM_WEBHOOK_URL: toOptional(raw.TELEGRAM_WEBHOOK_URL),
    TELEGRAM_WEBHOOK_SECRET: toOptional(raw.TELEGRAM_WEBHOOK_SECRET),
    RABBITMQ_URL: toOptional(raw.RABBITMQ_URL),
  });

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  if (
    result.data.TELEGRAM_WEBHOOK_URL &&
    !result.data.TELEGRAM_WEBHOOK_SECRET
  ) {
    throw new Error(
      "TELEGRAM_WEBHOOK_SECRET обязателен при заданном TELEGRAM_WEBHOOK_URL",
    );
  }

  if (
    result.data.NODE_ENV === "production" &&
    result.data.RABBITMQ_URL === undefined
  ) {
    throw new Error("RABBITMQ_URL обязателен в production");
  }

  return result.data;
}
