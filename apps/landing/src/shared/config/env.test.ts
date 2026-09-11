import { describe, expect, it } from "vitest";
import {
  DEFAULT_APP_URL,
  DEFAULT_GITHUB_URL,
  DEFAULT_SITE_URL,
  envConfig,
  getProductionSiteUrl,
  getSafeEnvConfig,
  getSiteUrl,
  validateEnv,
} from "./env";

describe("env configuration (CRIT-08)", () => {
  describe("safe module evaluation & defaults", () => {
    it("should export envConfig without throwing on module import", () => {
      expect(envConfig).toBeDefined();
      expect(envConfig.siteUrl).toBeDefined();
      expect(envConfig.appUrl).toBeDefined();
    });

    it("getSiteUrl returns canonical default or resolved siteUrl", () => {
      const siteUrl = getSiteUrl();
      expect(siteUrl).toBeDefined();
      expect(typeof siteUrl).toBe("string");
      expect(siteUrl.length).toBeGreaterThan(0);
    });

    it("getSafeEnvConfig returns canonical defaults when env is empty", () => {
      const config = getSafeEnvConfig({});
      expect(config.siteUrl).toBe(DEFAULT_SITE_URL);
      expect(config.appUrl).toBe(DEFAULT_APP_URL);
      expect(config.authUrl).toBe(`${DEFAULT_APP_URL}/login`);
      expect(config.registerUrl).toBe(`${DEFAULT_APP_URL}/register`);
      expect(config.githubUrl).toBe(DEFAULT_GITHUB_URL);
    });

    it("getSafeEnvConfig does not throw in production when env contains localhost, but safely uses canonical fallback", () => {
      const config = getSafeEnvConfig({
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "http://localhost:4321",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_AUTH_URL: "http://localhost:3000/login",
        NEXT_PUBLIC_REGISTER_URL: "http://localhost:3000/register",
      });

      expect(config.siteUrl).toBe(DEFAULT_SITE_URL);
      expect(config.appUrl).toBe(DEFAULT_APP_URL);
      expect(config.authUrl).toBe(`${DEFAULT_APP_URL}/login`);
      expect(config.registerUrl).toBe(`${DEFAULT_APP_URL}/register`);
    });

    it("getSafeEnvConfig uses custom production URL when valid", () => {
      const config = getSafeEnvConfig({
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://custom.landing.com",
        NEXT_PUBLIC_APP_URL: "https://custom.app.com",
      });

      expect(config.siteUrl).toBe("https://custom.landing.com");
      expect(config.appUrl).toBe("https://custom.app.com");
    });
  });

  describe("validateEnv (explicit environment validation)", () => {
    it("uses sensible defaults when env is empty in development/test", () => {
      const config = validateEnv({ NODE_ENV: "development" });
      expect(config.siteUrl).toBe(DEFAULT_SITE_URL);
      expect(config.appUrl).toBe(DEFAULT_APP_URL);
      expect(config.authUrl).toBe(`${DEFAULT_APP_URL}/login`);
      expect(config.registerUrl).toBe(`${DEFAULT_APP_URL}/register`);
      expect(config.githubUrl).toBe(DEFAULT_GITHUB_URL);
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

    it("throws in production if NEXT_PUBLIC_AUTH_URL contains localhost", () => {
      expect(() =>
        validateEnv({
          NODE_ENV: "production",
          NEXT_PUBLIC_AUTH_URL: "http://localhost:3000/login",
        }),
      ).toThrow("NEXT_PUBLIC_AUTH_URL cannot be localhost in production");
    });

    it("throws in production if NEXT_PUBLIC_REGISTER_URL contains localhost", () => {
      expect(() =>
        validateEnv({
          NODE_ENV: "production",
          NEXT_PUBLIC_REGISTER_URL: "http://localhost:3000/register",
        }),
      ).toThrow("NEXT_PUBLIC_REGISTER_URL cannot be localhost in production");
    });
  });

  describe("getProductionSiteUrl (strict production URL resolution)", () => {
    it("returns siteUrl when explicitly set in production", () => {
      const url = getProductionSiteUrl({
        NEXT_PUBLIC_SITE_URL: "https://mockinterviewai.com",
      });
      expect(url).toBe("https://mockinterviewai.com");
    });

    it("throws diagnostic error when NEXT_PUBLIC_SITE_URL is missing in production-sensitive context", () => {
      expect(() => getProductionSiteUrl({})).toThrow(
        "NEXT_PUBLIC_SITE_URL is required in production",
      );
    });

    it("throws diagnostic error when NEXT_PUBLIC_SITE_URL is localhost in production-sensitive context", () => {
      expect(() =>
        getProductionSiteUrl({
          NEXT_PUBLIC_SITE_URL: "http://localhost:4321",
        }),
      ).toThrow("NEXT_PUBLIC_SITE_URL cannot be localhost in production");
    });
  });
});
