"use client";

import { CheckIcon, CloseIcon, PlayIcon } from "@packages/icons";
import { Button, Typography } from "@packages/ui";
import type { RunResult } from "../model/types";

interface SandboxConsoleTestsProps {
  runResult: RunResult | null;
  isRunning: boolean;
  onRunCode: () => void;
}

export function SandboxConsoleTests({
  runResult,
  isRunning,
  onRunCode,
}: SandboxConsoleTestsProps) {
  if (!runResult && !isRunning) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <PlayIcon className="mb-2 size-6 opacity-40" />
        <Typography.P className="text-xs">
          Решение еще не запускалось.
        </Typography.P>
        <Button
          variant="link"
          size="sm"
          onClick={onRunCode}
          className="mt-1 text-xs"
        >
          Запустить тесты (Run Code)
        </Button>
      </div>
    );
  }

  if (isRunning) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="size-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <Typography.Small>Выполнение тест-кейсов...</Typography.Small>
        </div>
      </div>
    );
  }

  if (!runResult) return null;

  return (
    <div className="space-y-4">
      {/* Общий статус */}
      <div
        className={`flex items-center justify-between rounded-lg p-3 ${
          runResult.success
            ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : "border border-rose-500/30 bg-rose-500/10 text-rose-400"
        }`}
      >
        <div className="flex items-center gap-2 font-semibold">
          {runResult.success ? (
            <CheckIcon className="size-4.5" />
          ) : (
            <CloseIcon className="size-4.5" />
          )}
          <span>
            {runResult.success
              ? "Все тест-кейсы успешно пройдены!"
              : `Пройдено ${runResult.passedTests} из ${runResult.totalTests} тестов`}
          </span>
        </div>
        <Typography.Code className="text-[11px] opacity-80">
          {runResult.totalTimeMs} ms
        </Typography.Code>
      </div>

      {/* Список тест-кейсов */}
      <div className="grid gap-2.5">
        {runResult.results.map((res, idx) => (
          <div
            key={res.testCaseId}
            className={`rounded-lg border p-3 shadow-2xs ${
              res.passed
                ? "border-emerald-500/20 bg-background/60"
                : "border-rose-500/30 bg-rose-500/5"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`size-2 rounded-full ${
                    res.passed ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                />
                <Typography.Small className="font-semibold text-foreground">
                  Тест-кейс {idx + 1}
                </Typography.Small>
              </div>
              <Typography.Muted className="text-[10px]">
                {res.executionTimeMs} ms
              </Typography.Muted>
            </div>

            <div className="mt-2 space-y-1 text-[11px]">
              <div>
                <span className="text-muted-foreground">Вход: </span>
                <span className="text-foreground">{res.input}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Ожидалось: </span>
                <span className="text-emerald-400">{res.expectedOutput}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Получено: </span>
                <span
                  className={
                    res.passed ? "text-emerald-400" : "text-rose-400 font-bold"
                  }
                >
                  {res.actualOutput}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
