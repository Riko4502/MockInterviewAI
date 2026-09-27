import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(import.meta.dirname, "./src") },
      {
        find: /^monaco-editor$/,
        replacement: "monaco-editor/esm/vs/editor/editor.api.js",
      },
    ],
  },
  server: {
    deps: {
      inline: ["monaco-editor"],
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    css: true,
    server: {
      deps: {
        inline: [/monaco-editor/],
      },
    },
  },
});
