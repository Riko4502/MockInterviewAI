import { describe, expect, it } from "vitest";
import { getUserInitials } from "./get-user-initials";

describe("getUserInitials", () => {
  it("берёт первые буквы имени и фамилии", () => {
    expect(getUserInitials("Иван Петров")).toBe("ИП");
  });

  it("берёт первые символы email, если имени нет", () => {
    expect(getUserInitials(null, "dev@example.com")).toBe("DE");
  });

  it("возвращает запасной символ без данных", () => {
    expect(getUserInitials(null, null)).toBe("?");
  });
});
