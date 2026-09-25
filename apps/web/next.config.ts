import { sentryNextjsConfig } from "@packages/observability";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.OUTPUT_STANDALONE === "true" ? "standalone" : undefined,
  transpilePackages: [
    "@packages/i18n",
    "@packages/ui",
    "@packages/api",
    "@packages/observability",
  ],
  async rewrites() {
    const apiUrl =
      process.env.API_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:3001";

    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl.replace(/\/+$/, "")}/api/:path*`,
      },
    ];
  },
};

export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryNextjsConfig())
  : nextConfig;
