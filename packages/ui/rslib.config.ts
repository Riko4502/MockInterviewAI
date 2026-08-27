import path from "node:path";
import { pluginReact } from "@rsbuild/plugin-react";
import { defineConfig } from "@rslib/core";

export default defineConfig({
  plugins: [pluginReact()],
  lib: [
    {
      format: "esm",
      output: {
        distPath: {
          root: "./dist",
        },
      },
      dts: true,
    },
    {
      format: "cjs",
      output: {
        distPath: {
          root: "./dist",
        },
        minify: false,
      },
    },
  ],
  source: {
    entry: {
      index: "./src/index.ts",
      rsbuild: "./rsbuild/index.ts",
    },
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  output: {
    cleanDistPath: true,
    target: "web",
  },
});
