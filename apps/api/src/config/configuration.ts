/**
 * Возвращает типизированную конфигурацию приложения.
 *
 * Значения читаются из `process.env` (валидация выполняется в `env.validation.ts`),
 * доступ осуществляется через `ConfigService.get("jwt.accessSecret")` и т.д.
 *
 * @returns Объект конфигурации с вложенными секциями (database, jwt, argon2, redis, cookie, throttle).
 */
export const configuration = () => ({
  env: process.env.NODE_ENV ?? "development",
  port: Number(process.env.API_PORT ?? 3001),
  apiPrefix: process.env.API_PREFIX ?? "/api/v1",
  allowedOrigins: (
    process.env.ALLOWED_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000"
  )
    .split(",")
    .map((origin) => origin.trim()),
  database: {
    url: process.env.API_DATABASE_URL ?? "",
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? "",
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? "",
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRATION ?? "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION ?? "7d",
    issuer: process.env.JWT_ISSUER ?? "mock-interview-ai",
    audience: process.env.JWT_AUDIENCE ?? "api",
  },
  refreshTokenHashSecret: process.env.REFRESH_TOKEN_HASH_SECRET ?? "",
  argon2: {
    memoryCost: Number(process.env.ARGON2_MEMORY_COST ?? 65536),
    timeCost: Number(process.env.ARGON2_TIME_COST ?? 3),
    parallelism: Number(process.env.ARGON2_PARALLELISM ?? 4),
  },
  redis: {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD ?? "",
  },
  cookie: {
    secure: process.env.COOKIE_SECURE === "true",
  },
  throttle: {
    ttl: Number(process.env.THROTTLE_TTL ?? 60000),
    limit: Number(process.env.THROTTLE_LIMIT ?? 100),
  },
});

/** Тип конфигурации приложения (выводится из фабрики `configuration`). */
export type Config = ReturnType<typeof configuration>;

export default configuration;
