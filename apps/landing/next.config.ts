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
  ],
};

export default nextConfig;
