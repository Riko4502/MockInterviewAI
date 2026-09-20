import { z } from "zod";

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN обязателен"),
  TELEGRAM_BOT_USERNAME: z.string().min(1).default("MockInterviewBot"),
  API_INTERNAL_URL: z.string().url().default("http://localhost:3001/api/v1"),
  INTERNAL_SERVICE_KEY: z
    .string()
    .min(32, "INTERNAL_SERVICE_KEY должен содержать минимум 32 символа"),
  WEB_APP_URL: z.string().url().default("http://localhost:3000"),
  TELEGRAM_WEBHOOK_URL: z.string().url().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_PORT: z.coerce.number().int().positive().default(8443),
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

  return result.data;
}
