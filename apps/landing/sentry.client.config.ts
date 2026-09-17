import { sentryClientConfig } from "@packages/observability/sentry/client";
import * as Sentry from "@sentry/nextjs";

const sentryConfig = sentryClientConfig();
if (sentryConfig) {
  Sentry.init(sentryConfig);
}
