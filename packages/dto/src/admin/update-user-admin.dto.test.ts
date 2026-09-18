import { describe, expect, it } from "vitest";
import { updateUserAdminSchema } from "./update-user-admin.dto";

describe("updateUserAdminSchema", () => {
  it("успешно валидирует корректное обновление роли", () => {
    const result = updateUserAdminSchema.safeParse({ role: "ADMIN" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("ADMIN");
    }
  });

  it("отклоняет пустую строку или строку из пробелов в role", () => {
    const resultEmpty = updateUserAdminSchema.safeParse({ role: "" });
    expect(resultEmpty.success).toBe(false);
    if (!resultEmpty.success) {
      const roleError = resultEmpty.error.issues.find((issue) =>
        issue.path.includes("role"),
      );
      expect(roleError?.message).toBe("Role must not be empty");
    }

    const resultSpaces = updateUserAdminSchema.safeParse({ role: "   " });
    expect(resultSpaces.success).toBe(false);
    if (!resultSpaces.success) {
      const roleError = resultSpaces.error.issues.find((issue) =>
        issue.path.includes("role"),
      );
      expect(roleError?.message).toBe("Role must not be empty");
    }
  });

  it("позволяет опускать поле role", () => {
    const result = updateUserAdminSchema.safeParse({ displayName: "New Name" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBeUndefined();
    }
  });
});
