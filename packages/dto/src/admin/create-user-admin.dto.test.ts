import { describe, expect, it } from "vitest";
import { createUserAdminSchema } from "./create-user-admin.dto";

describe("createUserAdminSchema", () => {
  const validPayload = {
    email: "admin-created@example.com",
  };

  it("успешно валидирует корректные данные пользователя", () => {
    const result = createUserAdminSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("admin-created@example.com");
      expect(result.data.role).toBe("USER");
      expect(result.data.isActive).toBe(true);
    }
  });

  it("отклоняет пустой email", () => {
    const result = createUserAdminSchema.safeParse({ email: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailError = result.error.issues.find((issue) =>
        issue.path.includes("email"),
      );
      expect(emailError?.message).toBe("Email обязателен");
    }
  });

  it("отклоняет некорректный формат email", () => {
    const result = createUserAdminSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailError = result.error.issues.find((issue) =>
        issue.path.includes("email"),
      );
      expect(emailError?.message).toBe("Некорректный email");
    }
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

  it("отклоняет пустую строку или строку из пробелов в role", () => {
    const result = createUserAdminSchema.safeParse({
      ...validPayload,
      role: "   ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const roleError = result.error.issues.find((issue) =>
        issue.path.includes("role"),
      );
      expect(roleError?.message).toBe("Role must not be empty");
    }
  });
});
