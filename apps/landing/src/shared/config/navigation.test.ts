import { describe, expect, it } from "vitest";
import {
  getAppUrl,
  getAuthUrl,
  getRegisterUrl,
  navigationConfig,
} from "./navigation";

describe("navigation configuration", () => {
  it("should have a valid default authUrl", () => {
    expect(navigationConfig.authUrl).toBeDefined();
    expect(navigationConfig.authUrl).toContain("login");
  });

  it("should have a valid default registerUrl", () => {
    expect(navigationConfig.registerUrl).toBeDefined();
    expect(navigationConfig.registerUrl).toContain("register");
  });

  it("should have a valid default githubUrl", () => {
    expect(navigationConfig.githubUrl).toBeDefined();
    expect(navigationConfig.githubUrl).toContain("github.com");
  });

  it("getAuthUrl should return navigationConfig.authUrl", () => {
    expect(getAuthUrl()).toBe(navigationConfig.authUrl);
  });

  it("getRegisterUrl should return navigationConfig.registerUrl", () => {
    expect(getRegisterUrl()).toBe(navigationConfig.registerUrl);
  });

  it("getAppUrl should append paths correctly", () => {
    expect(getAppUrl("/dashboard")).toBe(
      `${navigationConfig.appUrl}/dashboard`,
    );
  });
});
