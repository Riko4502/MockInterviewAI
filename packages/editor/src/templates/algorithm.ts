import type { LanguageId } from "@/languages/config";

/**
 * Стартовые шаблоны (бойлерплейты) для алгоритмических задач.
 * Ключ - идентификатор языка, значение - стартовый код (функция или класс, которую нужно реализовать).
 */
export const ALGORITHM_TEMPLATES: Partial<Record<LanguageId, string>> = {
  typescript: `function solution(nums: number[]): number {\n  // Ваш код здесь\n  return 0;\n}\n`,
  javascript: `function solution(nums) {\n  // Ваш код здесь\n  return 0;\n}\n`,
  python: `def solution(nums: list[int]) -> int:\n    # Ваш код здесь\n    pass\n`,
  go: `package main\n\nfunc solution(nums []int) int {\n\t// Ваш код здесь\n\treturn 0\n}\n`,
  java: `class Solution {\n    public int solution(int[] nums) {\n        // Ваш код здесь\n        return 0;\n    }\n}\n`,
  cpp: `#include <vector>\n\nusing namespace std;\n\nclass Solution {\npublic:\n    int solution(vector<int>& nums) {\n        // Ваш код здесь\n        return 0;\n    }\n};\n`,
  rust: `impl Solution {\n    pub fn solution(nums: Vec<i32>) -> i32 {\n        // Ваш код здесь\n        0\n    }\n}\n`,
};
