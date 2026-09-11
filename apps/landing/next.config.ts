import { sentryNextjsConfig } from "@packages/observability";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "dist",
  trailingSlash: true,
  transpilePackages: [
    "@packages/i18n",
    "@packages/ui",
    "@packages/icons",
    "@packages/utils",
"@packages/tailwind-config",
    "@packages/editor",
    "@packages/observability",
  ],
};

export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryNextjsConfig())
  : nextConfig;
