import { describe, expect, it } from "vitest";
import { loginSchema } from "./login.dto";

const PASSWORD = "Str0ngPassw0rd!123";

describe("loginSchema", () => {
  describe("успешная валидация", () => {
    it("корректный email и непустой пароль", () => {
      const result = loginSchema.parse({
        email: "user@example.com",
        password: PASSWORD,
      });
      expect(result).toEqual({
        email: "user@example.com",
        password: PASSWORD,
      });
    });

    it("пароль короче password policy проходит (policy к логину не применяется, §58)", () => {
      const result = loginSchema.parse({
        email: "user@example.com",
        password: "short12char",
      });
      expect(result.password).toBe("short12char");
    });
  });

  describe("нормализация email (§5, §8)", () => {
    it("lowercase + trim email — как в registerSchema", () => {
      const result = loginSchema.parse({
        email: "  USER@EXAMPLE.COM  ",
        password: PASSWORD,
      });
      expect(result.email).toBe("user@example.com");
    });
  });

  describe("ошибки пароля", () => {
    it("пустой пароль → ошибка", () => {
      const r = loginSchema.safeParse({
        email: "user@example.com",
        password: "",
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe("Password is required");
      }
    });

    it("пароль >128 символов → ошибка", () => {
      const r = loginSchema.safeParse({
        email: "user@example.com",
        password: "a".repeat(129),
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe(
          "Password must be at most 128 characters",
        );
      }
    });

    it("пароль ровно 128 символов проходит", () => {
      const result = loginSchema.parse({
        email: "user@example.com",
        password: "a".repeat(128),
      });
      expect(result.password).toHaveLength(128);
    });
  });

  describe("ошибки email", () => {
    it("некорректный формат → ошибка", () => {
      const r = loginSchema.safeParse({
        email: "not-an-email",
        password: PASSWORD,
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe("Invalid email format");
      }
    });
  });
});
