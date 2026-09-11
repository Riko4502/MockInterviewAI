import type { init } from "@sentry/nextjs";

import { parseSentryEnv } from "./env.js";

type SentryRuntimeOptions = NonNullable<Parameters<typeof init>[0]>;

/**
 * Returns runtime Sentry options for Next.js server and edge runtimes.
 *
 * Usage in sentry.server.config.ts / sentry.edge.config.ts:
 * ```ts
 * import * as Sentry from "@sentry/nextjs";
 * import { sentryRuntimeConfig } from "@packages/observability";
 *
 * if (process.env.SENTRY_DSN) {
 *   Sentry.init(sentryRuntimeConfig());
 * }
 * ```
 */
export function sentryRuntimeConfig(): SentryRuntimeOptions {
  const env = parseSentryEnv();

  return {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  };
}
