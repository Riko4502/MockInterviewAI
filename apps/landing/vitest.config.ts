import { fileURLToPath } from "node:url";

export default {
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary"],
      include: ["src/**/*.{ts,js}"],
      exclude: ["src/**/*.d.ts", "src/**/*.test.ts"],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@components": fileURLToPath(
        new URL("./src/components", import.meta.url),
      ),
      "@styles": fileURLToPath(new URL("./src/styles", import.meta.url)),
      "@i18n": fileURLToPath(new URL("./src/i18n", import.meta.url)),
      "@config": fileURLToPath(new URL("./src/config", import.meta.url)),
    },
  },
};
