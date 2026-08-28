import { pluginReact } from "@rsbuild/plugin-react";
import { defineConfig } from "@rslib/core";

export default defineConfig({
  source: {
    entry: {
      index: ["./src/**"],
    },
  },
  lib: [
    {
      bundle: false,
      format: "esm",
      dts: true,
    },
  ],
  output: {
    copy: [
      {
        from: "./src/styles",
        to: "./styles",
      },
    ],
  },
  plugins: [pluginReact()],
});
