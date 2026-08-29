import { z } from "zod";

/** Zod-схема переменных окружения приложения (полный набор из §49 SPEC.md). */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_PREFIX: z.string().min(1).default("/api/v1"),
  ALLOWED_ORIGINS: z
    .string()
    .min(1)
    .default("http://localhost:3000,http://127.0.0.1:3000"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRATION: z.string().min(1).default("15m"),
  JWT_REFRESH_EXPIRATION: z.string().min(1).default("7d"),
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
  REFRESH_TOKEN_COOKIE_NAME: z.string().min(1).default("refresh_token"),
  THROTTLE_TTL: z.coerce.number().int().positive().default(60000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: z.string().default("minioadmin"),
  S3_SECRET_KEY: z.string().default("minioadmin"),
  S3_BUCKET_NAME: z.string().default("mock-interview-storage"),
  S3_PUBLIC_URL: z
    .string()
    .default("http://localhost:9000/mock-interview-storage"),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("true"),
  MAX_AVATAR_SIZE_BYTES: z.coerce.number().int().positive().default(2_097_152),
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
