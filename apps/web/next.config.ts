import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.OUTPUT_STANDALONE === "true" ? "standalone" : undefined,
  transpilePackages: ["@packages/i18n", "@packages/ui", "@packages/api"],
};

export default nextConfig;
