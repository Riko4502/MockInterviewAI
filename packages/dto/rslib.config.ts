import { defineConfig } from "@rslib/core";

export default defineConfig({
  source: {
    entry: {
      index: "./src/index.ts",
    },
  },
  lib: [
    {
      bundle: true,
      format: "esm",
      dts: true,
      autoExternal: {
        dependencies: false,
      },
    },
    {
      bundle: true,
      format: "cjs",
      autoExternal: {
        dependencies: false,
      },
    },
  ],
  output: {
    externals: ["zod"],
  },
});
