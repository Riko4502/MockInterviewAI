import { describe, expect, it } from "vitest";
import { MOCK_INTERVIEW_TASKS } from "../model/tasks";
import { executeCodeInBrowser } from "./code-runner";

describe("Sandbox Code Runner", () => {
  const twoSumTask =
    MOCK_INTERVIEW_TASKS.find((t) => t.id === "two-sum") ??
    MOCK_INTERVIEW_TASKS[0];
  const palindromeTask =
    MOCK_INTERVIEW_TASKS.find((t) => t.id === "valid-palindrome") ??
    MOCK_INTERVIEW_TASKS[0];

  it("should successfully run valid Two Sum solution in JavaScript", async () => {
    const code = `
      function twoSum(nums, target) {
        const map = new Map();
        for (let i = 0; i < nums.length; i++) {
          const complement = target - nums[i];
          if (map.has(complement)) {
            return [map.get(complement), i];
          }
          map.set(nums[i], i);
        }
        return [];
      }
    `;

    const result = await executeCodeInBrowser(code, twoSumTask, "javascript");

    expect(result.success).toBe(true);
    expect(result.passedTests).toBe(3);
    expect(result.totalTests).toBe(3);
    expect(result.results.every((r) => r.passed)).toBe(true);
  });

  it("should report failures when solution produces wrong result", async () => {
    const wrongCode = `
      function twoSum(nums, target) {
        return [0, 0];
      }
    `;

    const result = await executeCodeInBrowser(
      wrongCode,
      twoSumTask,
      "javascript",
    );

    expect(result.success).toBe(false);
    expect(result.passedTests).toBe(0);
  });

  it("should catch syntax and missing function errors", async () => {
    const invalidCode = `
      function wrongName() { return 42; }
    `;

    const result = await executeCodeInBrowser(
      invalidCode,
      twoSumTask,
      "javascript",
    );

    expect(result.success).toBe(false);
    expect(result.logs.some((l) => l.includes("Execution Error"))).toBe(true);
  });

  it("should capture console.log output during execution", async () => {
    const codeWithLogs = `
      function isPalindrome(s) {
        console.log("Checking string:", s);
        const clean = s.toLowerCase().replace(/[^a-z0-9]/g, "");
        return clean === clean.split("").reverse().join("");
      }
    `;

    const result = await executeCodeInBrowser(
      codeWithLogs,
      palindromeTask,
      "javascript",
    );

    expect(result.success).toBe(true);
    expect(result.logs.some((l) => l.includes("Checking string:"))).toBe(true);
  });
});
