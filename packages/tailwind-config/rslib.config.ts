import { defineConfig } from "@rslib/core";

export default defineConfig({
  source: {
    entry: {
      index: ["./src/**", "!./src/**/*.test.ts"],
    },
  },
  lib: [
    {
      bundle: false,
      format: "esm",
      dts: true,
    },
  ],
});
