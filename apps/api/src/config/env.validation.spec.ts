import { validate } from "./env.validation";

const requiredEnv = {
  API_DATABASE_URL: "postgresql://localhost/test",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  REFRESH_TOKEN_HASH_SECRET: "c".repeat(32),
  INTERNAL_SERVICE_KEY: "d".repeat(32),
};
const github = {
  GITHUB_CLIENT_ID: "client",
  GITHUB_CLIENT_SECRET: "secret",
  GITHUB_CALLBACK_URL: "https://api.example.com/api/v1/auth/github/callback",
  FRONTEND_URL: "https://web.example.com",
};
const githubHttp = {
  ...github,
  GITHUB_CALLBACK_URL: "http://api.example.com/api/v1/auth/github/callback",
  FRONTEND_URL: "http://web.example.com",
};
describe("Валидация переменных окружения GitHub OAuth", () => {
  it("сохраняет возможность входа по паролю без настройки OAuth", () => {
    expect(() => validate(requiredEnv)).not.toThrow();
  });
  it("принимает полную конфигурацию OAuth", () => {
    expect(validate({ ...requiredEnv, ...github })).toMatchObject(github);
  });
  it.each([
    "GITHUB_CALLBACK_URL",
    "FRONTEND_URL",
  ])("отклоняет HTTP URL %s в production", (key) => {
    expect(() =>
      validate({
        ...requiredEnv,
        NODE_ENV: "production",
        ...github,
        [key]: githubHttp[key as keyof typeof githubHttp],
      }),
    ).toThrow(
      "GitHub OAuth callback and frontend URLs must use HTTPS in production",
    );
  });
  it("принимает HTTPS-конфигурацию OAuth в production и сохраняет настройки GitHub", () => {
    expect(
      validate({ ...requiredEnv, NODE_ENV: "production", ...github }),
    ).toMatchObject(github);
  });
  it("сохраняет HTTP URL для development и test", () => {
    expect(validate({ ...requiredEnv, ...githubHttp })).toMatchObject(
      githubHttp,
    );
    expect(
      validate({ ...requiredEnv, NODE_ENV: "test", ...githubHttp }),
    ).toMatchObject(githubHttp);
  });
  it.each([
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "GITHUB_CALLBACK_URL",
    "FRONTEND_URL",
  ])("отклоняет неполную конфигурацию без %s", (key) => {
    expect(() =>
      validate({ ...requiredEnv, ...github, [key]: undefined }),
    ).toThrow();
  });
  it.each([
    "GITHUB_CALLBACK_URL",
    "FRONTEND_URL",
  ])("отклоняет URL без протокола HTTP или HTTPS в %s", (key) => {
    expect(() =>
      validate({ ...requiredEnv, ...github, [key]: "javascript:alert(1)" }),
    ).toThrow();
  });
});

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
