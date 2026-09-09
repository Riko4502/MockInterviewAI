import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@packages/i18n", "@packages/ui", "@packages/api"],
};

export default nextConfig;
