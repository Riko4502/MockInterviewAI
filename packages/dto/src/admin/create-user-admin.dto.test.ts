import { describe, expect, it } from "vitest";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../auth/password-policy";
import { createUserAdminSchema } from "./create-user-admin.dto";

describe("createUserAdminSchema", () => {
  const validPayload = {
    email: "admin-created@example.com",
    password: "StrongPassword123!",
  };

  it("успешно валидирует корректные данные пользователя", () => {
    const result = createUserAdminSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("admin-created@example.com");
      expect(result.data.password).toBe("StrongPassword123!");
      expect(result.data.role).toBe("USER");
      expect(result.data.isActive).toBe(true);
    }
  });

  it(`отклоняет пароль короче ${PASSWORD_MIN_LENGTH} символов (§CWE-521)`, () => {
    const shortPassword = "a".repeat(PASSWORD_MIN_LENGTH - 1);
    const result = createUserAdminSchema.safeParse({
      ...validPayload,
      password: shortPassword,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const passwordError = result.error.issues.find((issue) =>
        issue.path.includes("password"),
      );
      expect(passwordError).toBeDefined();
      expect(passwordError?.message).toContain(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      );
    }
  });

  it(`принимает пароль длиной ровно ${PASSWORD_MIN_LENGTH} символов`, () => {
    const exactMinPassword = "a".repeat(PASSWORD_MIN_LENGTH);
    const result = createUserAdminSchema.safeParse({
      ...validPayload,
      password: exactMinPassword,
    });
    expect(result.success).toBe(true);
  });

  it(`отклоняет пароль длиннее ${PASSWORD_MAX_LENGTH} символов`, () => {
    const tooLongPassword = "a".repeat(PASSWORD_MAX_LENGTH + 1);
    const result = createUserAdminSchema.safeParse({
      ...validPayload,
      password: tooLongPassword,
    });
    expect(result.success).toBe(false);
  });

  it("нормализует email (trim + lowercase)", () => {
    const result = createUserAdminSchema.safeParse({
      ...validPayload,
      email: "  Test.Admin@Example.COM  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("test.admin@example.com");
    }
  });
});
