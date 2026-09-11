import type { NodeOptions } from "@sentry/nestjs";
import { nestIntegration } from "@sentry/nestjs";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

import { parseSentryEnv } from "./env.js";

/**
 * Returns a preset Sentry configuration for NestJS applications.
 *
 * Usage in instrument.ts (before AppModule import):
 * ```ts
 * import { init } from "@sentry/nestjs";
 * import { sentryNestjsConfig } from "@packages/observability/sentry";
 *
 * init(sentryNestjsConfig());
 * ```
 */
export function sentryNestjsConfig(): NodeOptions {
  const env = parseSentryEnv();

  return {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    // Requires @sentry/profiling-node as a peer dependency.
    profilesSampleRate: 1.0,
    integrations: [nestIntegration(), nodeProfilingIntegration()],
    // Don't report health check endpoints
    beforeSendTransaction(event) {
      if (event.transaction?.includes("/health")) {
        return null;
      }
      return event;
    },
  };
}
