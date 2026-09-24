import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    pool: "forks",
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary"],
    },
  },
});
