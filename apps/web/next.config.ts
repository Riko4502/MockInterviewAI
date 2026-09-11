import { sentryNextjsConfig } from "@packages/observability";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@packages/i18n",
    "@packages/ui",
    "@packages/api",
    "@packages/observability",
  ],
};

export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryNextjsConfig())
  : nextConfig;
