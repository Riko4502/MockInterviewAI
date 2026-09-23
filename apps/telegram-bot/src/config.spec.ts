import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";

const BASE_ENV: Record<string, string> = {
  TELEGRAM_BOT_TOKEN: "mock-telegram-bot-token",
  INTERNAL_SERVICE_KEY: "mock-internal-service-key-0123456789abcdef",
};

describe("loadConfig: API_INTERNAL_URL (HTTP только для localhost)", () => {
  it("default: http://localhost разрешён (dev)", () => {
    const env = loadConfig(BASE_ENV);
    expect(env.API_INTERNAL_URL).toBe("http://localhost:3001/api/v1");
  });

  it("http://127.0.0.1 разрешён (dev)", () => {
    const env = loadConfig({
      ...BASE_ENV,
      API_INTERNAL_URL: "http://127.0.0.1:3001/api/v1",
    });
    expect(env.API_INTERNAL_URL).toBe("http://127.0.0.1:3001/api/v1");
  });

  it("https URL разрешён вне localhost", () => {
    const env = loadConfig({
      ...BASE_ENV,
      API_INTERNAL_URL: "https://api.example.com/api/v1",
    });
    expect(env.API_INTERNAL_URL).toBe("https://api.example.com/api/v1");
  });

  it("http вне localhost отклоняется (CWE-319)", () => {
    expect(() =>
      loadConfig({
        ...BASE_ENV,
        API_INTERNAL_URL: "http://api.example.com/api/v1",
      }),
    ).toThrow(/API_INTERNAL_URL/);
  });
});

describe("loadConfig: TELEGRAM_WEBHOOK_URL", () => {
  it("разрешает URL с webhook-путём", () => {
    const env = loadConfig({
      ...BASE_ENV,
      TELEGRAM_WEBHOOK_URL: "https://bot.example.com/telegram/webhook",
      TELEGRAM_WEBHOOK_SECRET: "webhook-secret",
    });

    expect(env.TELEGRAM_WEBHOOK_URL).toBe(
      "https://bot.example.com/telegram/webhook",
    );
  });

  it("отклоняет URL с другим путём", () => {
    expect(() =>
      loadConfig({
        ...BASE_ENV,
        TELEGRAM_WEBHOOK_URL: "https://bot.example.com/another-webhook",
        TELEGRAM_WEBHOOK_SECRET: "webhook-secret",
      }),
    ).toThrow(/TELEGRAM_WEBHOOK_URL/);
  });
});
