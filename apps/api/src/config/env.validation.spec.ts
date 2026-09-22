import { validate } from "./env.validation";

const requiredEnv = {
  API_DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  REFRESH_TOKEN_HASH_SECRET: "c".repeat(32),
};

describe("env.validation SENTRY_DSN", () => {
  it("принимает отсутствующий DSN", () => {
    const env = validate(requiredEnv);
    expect(env.SENTRY_DSN).toBeUndefined();
  });

  it("нормализует пустой DSN в undefined", () => {
    const env = validate({ ...requiredEnv, SENTRY_DSN: "" });
    expect(env.SENTRY_DSN).toBeUndefined();
  });

  it("нормализует DSN из пробелов в undefined", () => {
    const env = validate({ ...requiredEnv, SENTRY_DSN: "   " });
    expect(env.SENTRY_DSN).toBeUndefined();
  });

  it("принимает корректный URL", () => {
    const env = validate({
      ...requiredEnv,
      SENTRY_DSN: "https://public@sentry.example/1",
    });
    expect(env.SENTRY_DSN).toBe("https://public@sentry.example/1");
  });

  it("отвергает некорректный URL", () => {
    expect(() => validate({ ...requiredEnv, SENTRY_DSN: "not-a-url" })).toThrow(
      "SENTRY_DSN must be a valid URL",
    );
  });
});

describe("env.validation TELEGRAM_BOT_TOKEN", () => {
  it("требует TELEGRAM_BOT_TOKEN в production", () => {
    expect(() =>
      validate({
        ...requiredEnv,
        NODE_ENV: "production",
      }),
    ).toThrow("TELEGRAM_BOT_TOKEN is required in production environment");
  });

  it("успешно проигрывает валидацию в production при наличии TELEGRAM_BOT_TOKEN", () => {
    const env = validate({
      ...requiredEnv,
      NODE_ENV: "production",
      TELEGRAM_BOT_TOKEN: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    });
    expect(env.TELEGRAM_BOT_TOKEN).toBe(
      "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    );
  });
});
