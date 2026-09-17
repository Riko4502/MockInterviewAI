import { sentryRuntimeConfig } from "@packages/observability/sentry/edge";
import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init(sentryRuntimeConfig());
}
