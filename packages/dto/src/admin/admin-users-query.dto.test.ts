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

  describe("границы пагинации и приведение типов (page / limit)", () => {
    it("приводит строковые значения page и limit к числам через z.coerce (limit: '50' -> 50)", () => {
      const result = adminUsersQuerySchema.safeParse({
        page: "5",
        limit: "50",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(5);
        expect(result.data.limit).toBe(50);
        expect(typeof result.data.page).toBe("number");
        expect(typeof result.data.limit).toBe("number");
      }
    });

    it("отклоняет limit > 100 (limit: '101' и limit: 101)", () => {
      const resStr = adminUsersQuerySchema.safeParse({ limit: "101" });
      expect(resStr.success).toBe(false);

      const resNum = adminUsersQuerySchema.safeParse({ limit: 101 });
      expect(resNum.success).toBe(false);
    });

    it("отклоняет page < 1 (page: '0', page: 0, page: '-1')", () => {
      const resStrZero = adminUsersQuerySchema.safeParse({ page: "0" });
      expect(resStrZero.success).toBe(false);

      const resNumZero = adminUsersQuerySchema.safeParse({ page: 0 });
      expect(resNumZero.success).toBe(false);

      const resNegative = adminUsersQuerySchema.safeParse({ page: "-1" });
      expect(resNegative.success).toBe(false);
    });

    it("отклоняет limit < 1 (limit: '0', limit: 0, limit: '-1')", () => {
      const resStrZero = adminUsersQuerySchema.safeParse({ limit: "0" });
      expect(resStrZero.success).toBe(false);

      const resNumZero = adminUsersQuerySchema.safeParse({ limit: 0 });
      expect(resNumZero.success).toBe(false);

      const resNegative = adminUsersQuerySchema.safeParse({ limit: "-1" });
      expect(resNegative.success).toBe(false);
    });

    it("отклоняет нецелочисленные и нечисловые значения page и limit", () => {
      expect(adminUsersQuerySchema.safeParse({ page: "1.5" }).success).toBe(
        false,
      );
      expect(adminUsersQuerySchema.safeParse({ limit: "20.5" }).success).toBe(
        false,
      );
      expect(adminUsersQuerySchema.safeParse({ page: "abc" }).success).toBe(
        false,
      );
      expect(adminUsersQuerySchema.safeParse({ limit: "xyz" }).success).toBe(
        false,
      );
      expect(adminUsersQuerySchema.safeParse({ page: NaN }).success).toBe(
        false,
      );
      expect(adminUsersQuerySchema.safeParse({ limit: NaN }).success).toBe(
        false,
      );
    });

    it("принимает граничные допустимые значения page=1, limit=1 и limit=100", () => {
      const minBounds = adminUsersQuerySchema.safeParse({
        page: "1",
        limit: "1",
      });
      expect(minBounds.success).toBe(true);
      if (minBounds.success) {
        expect(minBounds.data.page).toBe(1);
        expect(minBounds.data.limit).toBe(1);
      }

      const maxLimit = adminUsersQuerySchema.safeParse({ limit: "100" });
      expect(maxLimit.success).toBe(true);
      if (maxLimit.success) {
        expect(maxLimit.data.limit).toBe(100);
      }
    });
  });
});
