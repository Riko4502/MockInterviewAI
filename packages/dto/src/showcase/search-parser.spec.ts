import { describe, expect, it } from "vitest";
import {
  normalizeSkill,
  parseSearchQuery,
  sanitizeSearchTerm,
  stripHtmlTags,
} from "./search-parser";

describe("search-parser", () => {
  describe("parseSearchQuery", () => {
    it("должен возвращать пустые массивы для пустых входных данных (undefined, null, пробелы)", () => {
      const emptyResult = { include: [], exclude: [], terms: [], raw: "" };

      expect(parseSearchQuery()).toEqual(emptyResult);
      expect(parseSearchQuery("")).toEqual(emptyResult);
      expect(parseSearchQuery("   ")).toEqual(emptyResult);
    });

    it("должен корректно разбирать +include токены", () => {
      const result = parseSearchQuery("+react +NestJS");

      expect(result.include).toEqual(["react", "nestjs"]);
      expect(result.exclude).toEqual([]);
      expect(result.terms).toEqual([]);
    });

    it("должен корректно разбирать -exclude токены", () => {
      const result = parseSearchQuery("-vue -Angular");

      expect(result.include).toEqual([]);
      expect(result.exclude).toEqual(["vue", "angular"]);
      expect(result.terms).toEqual([]);
    });

    it("должен отправлять обычные слова в terms", () => {
      const result = parseSearchQuery("junior middle fullstack");

      expect(result.terms).toEqual(["junior", "middle", "fullstack"]);
      expect(result.include).toEqual([]);
      expect(result.exclude).toEqual([]);
    });

    it("должен корректно разбирать смешанный запрос с + / - и обычными словами", () => {
      const result = parseSearchQuery("+react +nest -vue junior frontend");

      expect(result.include).toEqual(["react", "nest"]);
      expect(result.exclude).toEqual(["vue"]);
      expect(result.terms).toEqual(["junior", "frontend"]);
      expect(result.raw).toBe("+react +nest -vue junior frontend");
    });

    it("должен игнорировать одиночные символы '+' и '-' как невалидные операторы", () => {
      const result = parseSearchQuery("+ - +react");

      expect(result.include).toEqual(["react"]);
      expect(result.exclude).toEqual([]);
      expect(result.terms).toEqual(["+", "-"]);
    });

    it("должен дедуплицировать повторяющиеся токены", () => {
      const result = parseSearchQuery("+react +react -vue -vue junior junior");

      expect(result.include).toEqual(["react"]);
      expect(result.exclude).toEqual(["vue"]);
      expect(result.terms).toEqual(["junior"]);
    });

    it("должен ограничивать максимальное количество токенов до 10 (защита от DoS)", () => {
      const query = "w1 w2 w3 w4 w5 w6 w7 w8 w9 w10 w11 w12 w13";
      const result = parseSearchQuery(query);

      expect(result.terms).toHaveLength(10);
      expect(result.terms).toEqual([
        "w1",
        "w2",
        "w3",
        "w4",
        "w5",
        "w6",
        "w7",
        "w8",
        "w9",
        "w10",
      ]);
    });

    it("должен обрезать сырую строку до 100 символов", () => {
      const longQuery = "a".repeat(150);
      const result = parseSearchQuery(longQuery);

      expect(result.raw.length).toBe(100);
    });

    it("должен экранировать SQL спецсимволы в поисковых терминах", () => {
      const result = parseSearchQuery("+100% _test_ path\\to");

      expect(result.include).toEqual(["100\\%"]);
      expect(result.terms).toEqual(["\\_test\\_", "path\\\\to"]);
    });
  });

  describe("sanitizeSearchTerm", () => {
    it("должен экранировать символы %, _ и \\", () => {
      expect(sanitizeSearchTerm("100%")).toBe("100\\%");
      expect(sanitizeSearchTerm("user_name")).toBe("user\\_name");
      expect(sanitizeSearchTerm("C:\\path")).toBe("C:\\\\path");
      expect(sanitizeSearchTerm("%_\\")).toBe("\\%\\_\\\\");
    });

    it("не должен изменять строки без спецсимволов", () => {
      expect(sanitizeSearchTerm("react")).toBe("react");
      expect(sanitizeSearchTerm("frontend-dev 2026")).toBe("frontend-dev 2026");
    });
  });

  describe("stripHtmlTags", () => {
    it("должен удалять угловые скобки < и > (защита от XSS)", () => {
      expect(stripHtmlTags("<b>Жирный</b> <i>курсив</i>")).toBe(
        "bЖирный/b iкурсив/i",
      );
      expect(stripHtmlTags("<div class='box'><p>Текст</p></div>")).toBe(
        "div class='box'pТекст/p/div",
      );
      expect(stripHtmlTags("<script>alert(1)</script>")).toBe(
        "scriptalert(1)/script",
      );
      expect(stripHtmlTags("<script")).toBe("script");
    });

    it("должен убирать лишние пробелы по краям", () => {
      expect(stripHtmlTags("   <span>Привет</span>   ")).toBe(
        "spanПривет/span",
      );
    });

    it("не должен изменять чистый текст", () => {
      expect(stripHtmlTags("Обычный текст без тегов")).toBe(
        "Обычный текст без тегов",
      );
    });
  });

  describe("normalizeSkill", () => {
    it("должен приводить навык к нижнему регистру", () => {
      expect(normalizeSkill("React")).toBe("react");
      expect(normalizeSkill("TypeScript")).toBe("typescript");
    });

    it("должен удалять пробелы по краям и схлопывать внутренние пробелы", () => {
      expect(normalizeSkill("   React     Native   ")).toBe("react native");
      expect(normalizeSkill("System   Design")).toBe("system design");
    });
  });
});
