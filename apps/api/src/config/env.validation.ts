import { z } from "zod";

/** Zod-схема переменных окружения приложения (полный набор из §49 SPEC.md). */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3001),
  API_PREFIX: z.string().min(1).default("/api/v1"),
  CLIENT_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default("30d"),
  JWT_ISSUER: z.string().min(1).default("mock-interview-ai"),
  JWT_AUDIENCE: z.string().min(1).default("api"),
  REFRESH_TOKEN_HASH_SECRET: z.string().min(32),
  ARGON2_MEMORY_COST: z.coerce.number().int().positive().default(65536),
  ARGON2_TIME_COST: z.coerce.number().int().positive().default(3),
  ARGON2_PARALLELISM: z.coerce.number().int().positive().default(4),
  REDIS_HOST: z.string().min(1).default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().default(""),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
  THROTTLE_TTL: z.coerce.number().int().positive().default(60000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
});

/** Тип валидированного окружения приложения. */
export type Env = z.infer<typeof envSchema>;

/**
 * Валидирует и нормализует переменные окружения.
 *
 * @param config - Сырые переменные окружения (обычно `process.env`).
 * @returns Нормализованный объект окружения с применёнными дефолтами и коэрцингом типов.
 * @throws {Error} Если окружение не соответствует схеме (список проблем в сообщении).
 */
export function validate(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}
