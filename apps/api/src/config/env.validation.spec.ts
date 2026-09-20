import { validate } from "./env.validation";

const base = {
  API_DATABASE_URL: "postgresql://localhost/test",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  REFRESH_TOKEN_HASH_SECRET: "c".repeat(32),
};
const github = {
  GITHUB_CLIENT_ID: "client",
  GITHUB_CLIENT_SECRET: "secret",
  GITHUB_CALLBACK_URL: "https://api.example.com/api/v1/auth/github/callback",
  FRONTEND_URL: "https://web.example.com",
};
describe("Валидация переменных окружения GitHub OAuth", () => {
  it("сохраняет возможность входа по паролю без настройки OAuth", () => {
    expect(() => validate(base)).not.toThrow();
  });
  it("принимает полную конфигурацию OAuth", () => {
    expect(validate({ ...base, ...github })).toMatchObject(github);
  });
  it.each([
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "GITHUB_CALLBACK_URL",
    "FRONTEND_URL",
  ])("отклоняет неполную конфигурацию без %s", (key) => {
    expect(() => validate({ ...base, ...github, [key]: undefined })).toThrow();
  });
  it.each([
    "GITHUB_CALLBACK_URL",
    "FRONTEND_URL",
  ])("отклоняет URL без протокола HTTP или HTTPS в %s", (key) => {
    expect(() =>
      validate({ ...base, ...github, [key]: "javascript:alert(1)" }),
    ).toThrow();
  });
});
