/**
 * Предварительная настройка переменных окружения для Jest.
 *
 * Гарантирует наличие обязательных переменных окружения (§49 SPEC.md),
 * предотвращая сбои валидации Zod в CI-окружении при отсутствии локального .env.
 */
const DEFAULT_TEST_ENV: Record<string, string> = {
  NODE_ENV: "test",
  API_DATABASE_URL: "postgresql://mock:mock@localhost:5432/mock_test",
  JWT_ACCESS_SECRET: "mock-test-access-secret-at-least-32-characters-length",
  JWT_REFRESH_SECRET: "mock-test-refresh-secret-at-least-32-characters-length",
  REFRESH_TOKEN_HASH_SECRET: "mock-test-refresh-hash-secret-at-least-32-chars",
};

for (const [key, value] of Object.entries(DEFAULT_TEST_ENV)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}
