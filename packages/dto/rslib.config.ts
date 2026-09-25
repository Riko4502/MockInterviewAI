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
    },
    {
      bundle: true,
      format: "cjs",
    },
  ],
});
