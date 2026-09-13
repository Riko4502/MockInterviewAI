import { describe, expect, it } from "vitest";
import type { LanguageId } from "@/languages";
import { getTemplate } from "./get-template";

describe("getTemplate", () => {
  describe("Алгоритмические шаблоны", () => {
    const algorithmCases: { lang: LanguageId; expected: string }[] = [
      {
        lang: "typescript",
        expected: "function solution(nums: number[]): number",
      },
      { lang: "javascript", expected: "function solution(nums)" },
      { lang: "python", expected: "def solution(nums: list[int]) -> int:" },
      { lang: "go", expected: "func solution(nums []int) int" },
      { lang: "java", expected: "public int solution(int[] nums)" },
      { lang: "cpp", expected: "int solution(vector<int>& nums)" },
      { lang: "rust", expected: "pub fn solution(nums: Vec<i32>) -> i32" },
    ];

    algorithmCases.forEach(({ lang, expected }) => {
      it(`должен возвращать правильный шаблон для ${lang}`, () => {
        const template = getTemplate(lang, "algorithm");
        expect(template).toContain(expected);
      });
    });

    it("должен возвращать пустую строку для sql в категории algorithm", () => {
      const template = getTemplate("sql", "algorithm");
      expect(template).toBe("");
    });
  });

  describe("SQL шаблоны", () => {
    it("должен возвращать sql-шаблон для sql", () => {
      const template = getTemplate("sql", "sql");
      // noinspection SqlNoDataSourceInspection
      expect(template).toContain("SELECT * FROM users;");
    });

    it("должен возвращать пустую строку для typescript в категории sql", () => {
      const template = getTemplate("typescript", "sql");
      expect(template).toBe("");
    });
  });
});
