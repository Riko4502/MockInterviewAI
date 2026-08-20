import { describe, expect, it } from "vitest";
import { normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it("обрезает пробелы по краям", () => {
    expect(normalizeEmail("  test@example.com  ")).toBe("test@example.com");
  });

  it("приводит к нижнему регистру", () => {
    expect(normalizeEmail("TEST@EXAMPLE.COM")).toBe("test@example.com");
  });

  it("комбинирует trim и lowercase", () => {
    expect(normalizeEmail("  Test@Example.COM  ")).toBe("test@example.com");
  });

  it("возвращает ту же строку, если она уже нормализована", () => {
    expect(normalizeEmail("user@mail.com")).toBe("user@mail.com");
  });

  it("возвращает пустую строку для пустого ввода", () => {
    expect(normalizeEmail("")).toBe("");
  });

  it("возвращает пустую строку для строки из пробелов", () => {
    expect(normalizeEmail("   ")).toBe("");
  });

  it("не изменяет внутренние пробелы", () => {
    expect(normalizeEmail("user name@mail.com")).toBe("user name@mail.com");
  });
});
