import {
  registerSchema as dtoRegisterSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@packages/dto";
import { describe, expect, it } from "vitest";
import { registerSchema } from "./schemas";

describe("Frontend/Backend validation contract (@packages/dto single source of truth)", () => {
  it("apps/web re-exports registerSchema identically from @packages/dto", () => {
    expect(registerSchema).toBe(dtoRegisterSchema);
  });

  it("password policy is synchronized: min 12, max 128 characters", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
  });

  it("validates that 11 characters password fails and 12 characters succeeds in shared contract", () => {
    const invalidShort = registerSchema.safeParse({
      email: "test@example.com",
      password: "a".repeat(11),
      passwordConfirmation: "a".repeat(11),
    });
    expect(invalidShort.success).toBe(false);

    const validTwelve = registerSchema.safeParse({
      email: "test@example.com",
      password: "a".repeat(12),
      passwordConfirmation: "a".repeat(12),
    });
    expect(validTwelve.success).toBe(true);
  });

  it("validates cross-field password confirmation in shared contract", () => {
    const mismatch = registerSchema.safeParse({
      email: "test@example.com",
      password: "StrongPassword123!",
      passwordConfirmation: "DifferentPassword123!",
    });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.issues[0].message).toBe("Пароли не совпадают");
      expect(mismatch.error.issues[0].path).toEqual(["passwordConfirmation"]);
    }
  });
});
