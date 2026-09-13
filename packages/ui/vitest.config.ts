import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@components": path.resolve(import.meta.dirname, "./src/components"),
      "@hooks": path.resolve(import.meta.dirname, "./src/hooks"),
      "@model": path.resolve(import.meta.dirname, "./src/model"),
      "@lib": path.resolve(import.meta.dirname, "./src/lib"),
    },
  },
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["dist/**", "node_modules/**"],
    environment: "jsdom",
  },
});
