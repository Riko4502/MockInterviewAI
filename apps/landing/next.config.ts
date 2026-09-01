import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "dist",
  transpilePackages: [
    "@packages/i18n",
    "@packages/ui",
    "@packages/icons",
    "@packages/utils",
  ],
};

export default nextConfig;
