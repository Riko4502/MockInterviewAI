/**
 * Инициализирует Sentry до импорта AppModule (SPEC.md, §5.1).
 *
 * Подключается первым импортом в main.ts. Если SENTRY_DSN не задан —
 * Sentry не активируется, и приложение работает без ошибко-трекинга
 * (например, в локальном dev-окружении).
 */
if (process.env.SENTRY_DSN) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { sentryNestjsConfig } = require("@packages/observability");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { init } = require("@sentry/nestjs");
  init(sentryNestjsConfig());
}
