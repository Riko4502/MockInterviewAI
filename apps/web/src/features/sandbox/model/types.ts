import type { LanguageId } from "@packages/editor";

export type TaskDifficulty = "Easy" | "Medium" | "Hard";
export type TaskCategory =
  | "Algorithms"
  | "Data Structures"
  | "Strings"
  | "Design";

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  description?: string;
  /** Сырые параметры для вызова функции в JS/TS runner */
  args: unknown[];
  expected: unknown;
}

export interface TaskExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface InterviewTask {
  id: string;
  title: string;
  difficulty: TaskDifficulty;
  category: TaskCategory;
  description: string;
  examples: TaskExample[];
  constraints: string[];
  starterCode: Partial<Record<LanguageId, string>>;
  functionName: string;
  testCases: TestCase[];
  hints: string[];
}

export interface TestCaseResult {
  testCaseId: string;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  executionTimeMs: number;
  error?: string;
}

export interface RunResult {
  success: boolean;
  totalTests: number;
  passedTests: number;
  results: TestCaseResult[];
  logs: string[];
  totalTimeMs: number;
}
