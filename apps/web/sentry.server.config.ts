import { sentryRuntimeConfig } from "@packages/observability";
import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init(sentryRuntimeConfig());
}
