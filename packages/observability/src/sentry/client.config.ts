import type { init } from "@sentry/nextjs";
import { z } from "zod";

type SentryClientOptions = NonNullable<Parameters<typeof init>[0]>;

const browserEnv = z.object({
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: z
    .enum(["development", "staging", "production"])
    .default("production"),
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: z.coerce
    .number()
    .min(0)
    .max(1)
    .default(0.2),
});

/**
 * Returns runtime Sentry options for the Next.js browser (client) runtime.
 *
 * Client bundle cannot access server-only env vars, so the DSN must be exposed
 * as `NEXT_PUBLIC_SENTRY_DSN`. Returns `null` when the DSN is not configured —
 * e.g. in local development without Sentry.
 *
 * Usage in sentry.client.config.ts:
 * ```ts
 * import * as Sentry from "@sentry/nextjs";
 * import { sentryClientConfig } from "@packages/observability";
 *
 * const config = sentryClientConfig();
 * if (config) Sentry.init(config);
 * ```
 */
export function sentryClientConfig(): SentryClientOptions | null {
  const parsed = browserEnv.safeParse(process.env);
  if (!parsed.success || !parsed.data.NEXT_PUBLIC_SENTRY_DSN) {
    return null;
  }

  return {
    dsn: parsed.data.NEXT_PUBLIC_SENTRY_DSN,
    environment: parsed.data.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    tracesSampleRate: parsed.data.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  };
}
