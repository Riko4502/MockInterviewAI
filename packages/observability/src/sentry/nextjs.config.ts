import type { SentryBuildOptions } from "@sentry/nextjs";

import { parseSentryEnv } from "./env.js";

/**
 * Returns a preset Sentry configuration for Next.js applications.
 *
 * Usage in next.config.ts:
 * ```ts
 * import { withSentryConfig } from "@sentry/nextjs/config";
 * import { sentryNextjsConfig } from "@packages/observability/sentry";
 *
 * const nextConfig = { /* ... *\/ };
 * export default withSentryConfig(nextConfig, sentryNextjsConfig());
 * ```
 */
export function sentryNextjsConfig(): SentryBuildOptions {
  const env = parseSentryEnv();

  return {
    org: env.SENTRY_ORG,
    project: env.SENTRY_PROJECT,
    authToken: env.SENTRY_AUTH_TOKEN,
    silent: true,
    widenClientFileUpload: true,
    sourcemaps: { deleteSourcemapsAfterUpload: true },
    disableLogger: true,
  };
}
