import { z } from "zod";

/**
 * Zod-схема запроса на запуск кода пользователя.
 */
export const runCodeRequestSchema = z.object({
  code: z
    .string()
    .min(1, "Код не может быть пустым")
    .max(65536, "Превышен максимальный размер кода (64 КБ)"),
  language: z.string().min(1, "Язык программирования обязателен"),
  taskKey: z.string().optional(),
  taskId: z.string().optional(),
  stdin: z.string().max(65536).optional().default(""),
  timeoutMs: z.coerce
    .number()
    .int()
    .min(500, "Минимальный таймаут — 500 мс")
    .max(10000, "Максимальный таймаут — 10000 мс")
    .optional()
    .default(3000),
});

export type RunCodeRequestDto = z.infer<typeof runCodeRequestSchema>;

/**
 * Zod-схема результата отдельного тест-кейса.
 */
export const testCaseResultSchema = z.object({
  testCaseId: z.string(),
  passed: z.boolean(),
  input: z.string(),
  expectedOutput: z.string(),
  actualOutput: z.string(),
  executionTimeMs: z.number(),
  error: z.string().optional(),
});

export type TestCaseResultDto = z.infer<typeof testCaseResultSchema>;

/**
 * Zod-схема ответа на запуск кода.
 * Полностью совместима с интерфейсом RunResult фронтенда.
 */
export const runCodeResponseSchema = z.object({
  success: z.boolean(),
  totalTests: z.number(),
  passedTests: z.number(),
  results: z.array(testCaseResultSchema),
  logs: z.array(z.string()),
  totalTimeMs: z.number(),
  status: z.string().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  exitCode: z.number().optional(),
  memoryUsageBytes: z.number().optional(),
});

export type RunCodeResponseDto = z.infer<typeof runCodeResponseSchema>;
