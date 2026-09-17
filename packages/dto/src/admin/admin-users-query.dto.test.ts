import { describe, expect, it } from "vitest";
import { adminUsersQuerySchema } from "./admin-users-query.dto";

describe("adminUsersQuerySchema", () => {
  it("успешно парсит параметры по умолчанию", () => {
    const result = adminUsersQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sortBy).toBe("createdAt");
      expect(result.data.sortOrder).toBe("desc");
      expect(result.data.isActive).toBeUndefined();
    }
  });

  it("корректно парсит isActive как boolean true / false", () => {
    const resTrue = adminUsersQuerySchema.safeParse({ isActive: true });
    expect(resTrue.success).toBe(true);
    if (resTrue.success) {
      expect(resTrue.data.isActive).toBe(true);
    }

    const resFalse = adminUsersQuerySchema.safeParse({ isActive: false });
    expect(resFalse.success).toBe(true);
    if (resFalse.success) {
      expect(resFalse.data.isActive).toBe(false);
    }
  });

  it("корректно парсит строковые 'true' и 'false' из query-строки в boolean", () => {
    const resStrTrue = adminUsersQuerySchema.safeParse({ isActive: "true" });
    expect(resStrTrue.success).toBe(true);
    if (resStrTrue.success) {
      expect(resStrTrue.data.isActive).toBe(true);
    }

    const resStrFalse = adminUsersQuerySchema.safeParse({ isActive: "false" });
    expect(resStrFalse.success).toBe(true);
    if (resStrFalse.success) {
      expect(resStrFalse.data.isActive).toBe(false);
    }
  });

  it("выбрасывает ошибку валидации для некорректных значений isActive ('1', 1, 'TRUE', 'yes', 'invalid')", () => {
    const invalidValues = [
      "1",
      1,
      "TRUE",
      "FALSE",
      "yes",
      "no",
      "invalid",
      null,
    ];
    for (const val of invalidValues) {
      const result = adminUsersQuerySchema.safeParse({ isActive: val });
      expect(result.success).toBe(false);
    }
  });

  it("корректно парсит isDeleted как boolean и строковые 'true'/'false'", () => {
    const resTrue = adminUsersQuerySchema.safeParse({ isDeleted: true });
    expect(resTrue.success).toBe(true);
    if (resTrue.success) expect(resTrue.data.isDeleted).toBe(true);

    const resStrTrue = adminUsersQuerySchema.safeParse({ isDeleted: "true" });
    expect(resStrTrue.success).toBe(true);
    if (resStrTrue.success) expect(resStrTrue.data.isDeleted).toBe(true);

    const resFalse = adminUsersQuerySchema.safeParse({ isDeleted: false });
    expect(resFalse.success).toBe(true);
    if (resFalse.success) expect(resFalse.data.isDeleted).toBe(false);

    const resStrFalse = adminUsersQuerySchema.safeParse({ isDeleted: "false" });
    expect(resStrFalse.success).toBe(true);
    if (resStrFalse.success) expect(resStrFalse.data.isDeleted).toBe(false);
  });

  it("выбрасывает ошибку валидации для некорректных значений isDeleted", () => {
    const invalidValues = ["1", 1, "TRUE", "yes", null];
    for (const val of invalidValues) {
      const result = adminUsersQuerySchema.safeParse({ isDeleted: val });
      expect(result.success).toBe(false);
    }
  });
});
