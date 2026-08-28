import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@packages/i18n",
    "@packages/ui",
    "@packages/icons",
    "@packages/utils",
  ],
};

export default nextConfig;
