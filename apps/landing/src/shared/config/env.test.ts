import { describe, expect, it } from "vitest";
import { validateEnv } from "./env";

describe("validateEnv", () => {
  it("uses sensible defaults when env is empty in development/test", () => {
    const config = validateEnv({ NODE_ENV: "development" });
    expect(config.siteUrl).toBe("https://mockinterviewai.com");
    expect(config.appUrl).toBe("https://app.mockinterviewai.com");
    expect(config.authUrl).toBe("https://app.mockinterviewai.com/login");
    expect(config.registerUrl).toBe("https://app.mockinterviewai.com/register");
    expect(config.githubUrl).toBe(
      "https://github.com/Riko4502/MockInterviewAI",
    );
  });

  it("respects custom environment variables", () => {
    const config = validateEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_SITE_URL: "https://custom.landing.com",
      NEXT_PUBLIC_APP_URL: "https://custom.app.com",
      NEXT_PUBLIC_AUTH_URL: "https://custom.app.com/custom-login",
      NEXT_PUBLIC_REGISTER_URL: "https://custom.app.com/custom-register",
      NEXT_PUBLIC_GITHUB_URL: "https://github.com/custom/repo",
    });

    expect(config.siteUrl).toBe("https://custom.landing.com");
    expect(config.appUrl).toBe("https://custom.app.com");
    expect(config.authUrl).toBe("https://custom.app.com/custom-login");
    expect(config.registerUrl).toBe("https://custom.app.com/custom-register");
    expect(config.githubUrl).toBe("https://github.com/custom/repo");
  });

  it("throws in production if NEXT_PUBLIC_SITE_URL contains localhost", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "http://localhost:4321",
      }),
    ).toThrow("NEXT_PUBLIC_SITE_URL cannot be localhost in production");
  });

  it("throws in production if NEXT_PUBLIC_APP_URL contains localhost", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }),
    ).toThrow("NEXT_PUBLIC_APP_URL cannot be localhost in production");
  });
});
