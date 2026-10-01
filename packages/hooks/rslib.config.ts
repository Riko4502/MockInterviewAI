import { pluginReact } from "@rsbuild/plugin-react";
import { defineConfig } from "@rslib/core";

export default defineConfig({
  source: {
    entry: {
      index: ["./src/**", "!./src/**/*.test.{ts,tsx}"],
    },
  },
  lib: [
    {
      bundle: false,
      format: "esm",
      dts: true,
    },
  ],
  plugins: [pluginReact()],
});
