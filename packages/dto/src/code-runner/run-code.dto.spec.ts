import { describe, expect, it } from "vitest";
import { runCodeRequestSchema, runCodeResponseSchema } from "./run-code.dto";

describe("runCodeRequestSchema", () => {
  it("валидирует корректный запрос на запуск кода", () => {
    const input = {
      code: "console.log('hello')",
      language: "typescript",
    };

    const parsed = runCodeRequestSchema.parse(input);
    expect(parsed.code).toBe("console.log('hello')");
    expect(parsed.language).toBe("typescript");
    expect(parsed.timeoutMs).toBe(3000);
    expect(parsed.stdin).toBe("");
  });

  it("отклоняет пустой код", () => {
    const input = {
      code: "",
      language: "javascript",
    };

    expect(() => runCodeRequestSchema.parse(input)).toThrow();
  });

  it("отклоняет отсутствующий язык", () => {
    const input = {
      code: "print(1)",
    };

    expect(() => runCodeRequestSchema.parse(input)).toThrow();
  });

  it("проверяет границы timeoutMs", () => {
    expect(() =>
      runCodeRequestSchema.parse({
        code: "x = 1",
        language: "python",
        timeoutMs: 100, // < 500
      }),
    ).toThrow();

    expect(() =>
      runCodeRequestSchema.parse({
        code: "x = 1",
        language: "python",
        timeoutMs: 20000, // > 10000
      }),
    ).toThrow();
  });
});

describe("runCodeResponseSchema", () => {
  it("валидирует корректный ответ выполнения", () => {
    const response = {
      success: true,
      totalTests: 0,
      passedTests: 0,
      results: [],
      logs: ["Hello, world!"],
      totalTimeMs: 42,
      status: "SUCCESS",
      exitCode: 0,
    };

    const parsed = runCodeResponseSchema.parse(response);
    expect(parsed.success).toBe(true);
    expect(parsed.logs).toEqual(["Hello, world!"]);
  });
});
