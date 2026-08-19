import { describe, expect, it } from "vitest";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password-policy";

describe("password-policy", () => {
  it("PASSWORD_MIN_LENGTH равен 12", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
  });

  it("PASSWORD_MAX_LENGTH равен 128", () => {
    expect(PASSWORD_MAX_LENGTH).toBe(128);
  });

  it("MIN <= MAX", () => {
    expect(PASSWORD_MIN_LENGTH).toBeLessThanOrEqual(PASSWORD_MAX_LENGTH);
  });
});
