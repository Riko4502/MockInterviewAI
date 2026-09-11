import { sentryClientConfig } from "@packages/observability";
import * as Sentry from "@sentry/nextjs";

const sentryConfig = sentryClientConfig();
if (sentryConfig) {
  Sentry.init(sentryConfig);
}
