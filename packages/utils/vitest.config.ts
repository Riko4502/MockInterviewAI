import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@string": path.resolve(import.meta.dirname, "./src/string"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
