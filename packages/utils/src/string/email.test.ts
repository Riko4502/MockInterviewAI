import { describe, expect, it } from "vitest";
import { normalizeEmail } from "@/string/email";

describe("normalizeEmail", () => {
  it("should trim whitespace", () => {
    expect(normalizeEmail("  user@example.com  ")).toBe("user@example.com");
  });

  it("should convert email to lowercase", () => {
    expect(normalizeEmail("USER@EXAMPLE.COM")).toBe("user@example.com");
    expect(normalizeEmail("User.Name+Tag@Example.Com")).toBe(
      "user.name+tag@example.com",
    );
  });

  it("should handle already normalized email", () => {
    expect(normalizeEmail("test@test.com")).toBe("test@test.com");
  });
});
