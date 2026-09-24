import { describe, expect, it } from "vitest";
import { showcaseQuerySchema } from "./showcase-query.dto";

describe("showcaseQuerySchema", () => {
  describe("валидация isUrgent", () => {
    it("парсит строку 'true' как boolean true", () => {
      const result = showcaseQuerySchema.parse({ isUrgent: "true" });
      expect(result.isUrgent).toBe(true);
    });

    it("парсит строку '1' как boolean true", () => {
      const result = showcaseQuerySchema.parse({ isUrgent: "1" });
      expect(result.isUrgent).toBe(true);
    });

    it("парсит строку 'false' как boolean false, а не true", () => {
      const result = showcaseQuerySchema.parse({ isUrgent: "false" });
      expect(result.isUrgent).toBe(false);
    });

    it("парсит строку '0' как boolean false", () => {
      const result = showcaseQuerySchema.parse({ isUrgent: "0" });
      expect(result.isUrgent).toBe(false);
    });

    it("принимает нативные булевы значения true и false", () => {
      expect(showcaseQuerySchema.parse({ isUrgent: true }).isUrgent).toBe(true);
      expect(showcaseQuerySchema.parse({ isUrgent: false }).isUrgent).toBe(
        false,
      );
    });

    it("оставляет isUrgent undefined, если параметр не передан", () => {
      const result = showcaseQuerySchema.parse({});
      expect(result.isUrgent).toBeUndefined();
    });

    it("выбрасывает ошибку на некорректную строку", () => {
      expect(() =>
        showcaseQuerySchema.parse({ isUrgent: "not_a_boolean" }),
      ).toThrow();
    });
  });

  describe("значения по умолчанию", () => {
    it("выставляет sortBy=BUMPED, page=1, limit=20", () => {
      const result = showcaseQuerySchema.parse({});
      expect(result.sortBy).toBe("BUMPED");
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });
});
