import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
    environment: "jsdom",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/app/layout.tsx"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@app": path.resolve(import.meta.dirname, "./src/app"),
      "@pages": path.resolve(import.meta.dirname, "./src/pages"),
      "@views": path.resolve(import.meta.dirname, "./src/views"),
      "@widgets": path.resolve(import.meta.dirname, "./src/widgets"),
      "@features": path.resolve(import.meta.dirname, "./src/features"),
      "@entities": path.resolve(import.meta.dirname, "./src/entities"),
      "@shared": path.resolve(import.meta.dirname, "./src/shared"),
    },
  },
});
