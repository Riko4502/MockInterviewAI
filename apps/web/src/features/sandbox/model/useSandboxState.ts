"use client";

import type { LanguageId, Theme } from "@packages/editor";
import { useCallback, useEffect, useState } from "react";
import { executeCodeInBrowser } from "../lib/code-runner";
import { MOCK_INTERVIEW_TASKS } from "./tasks";
import type { InterviewTask, RunResult } from "./types";

const DEFAULT_TIMER_SECONDS = 45 * 60; // 45 минут

export function useSandboxState() {
  const [tasks] = useState<InterviewTask[]>(MOCK_INTERVIEW_TASKS);
  const [currentTaskId, setCurrentTaskId] = useState<string>("two-sum");
  const [language, setLanguage] = useState<LanguageId>("typescript");
  const [theme, setTheme] = useState<Theme>("dark");
  const [leftTab, setLeftTab] = useState<"description" | "hints" | "notes">(
    "description",
  );
  const [consoleTab, setConsoleTab] = useState<"tests" | "logs">("tests");
  const [notes, setNotes] = useState<string>("");
  const [revealedHints, setRevealedHints] = useState<number>(0);

  // Таймер
  const [timerSeconds, setTimerSeconds] = useState<number>(
    DEFAULT_TIMER_SECONDS,
  );
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // Выполнение кода
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  const currentTask = tasks.find((t) => t.id === currentTaskId) ?? tasks[0];

  // Код в редакторе
  const [code, setCode] = useState<string>(() => {
    return currentTask.starterCode[language] ?? "// Начните писать код здесь\n";
  });

  // Обновление шаблона кода при смене задачи или языка
  const handleTaskChange = useCallback(
    (taskId: string) => {
      setCurrentTaskId(taskId);
      const targetTask = tasks.find((t) => t.id === taskId) ?? tasks[0];
      setCode(
        targetTask.starterCode[language] ??
          targetTask.starterCode.typescript ??
          "",
      );
      setRunResult(null);
      setRevealedHints(0);
    },
    [language, tasks],
  );

  const handleLanguageChange = useCallback(
    (newLang: LanguageId) => {
      setLanguage(newLang);
      setCode(
        currentTask.starterCode[newLang] ?? "// Код на выбранном языке\n",
      );
      setRunResult(null);
    },
    [currentTask],
  );

  const resetCode = useCallback(() => {
    setCode(currentTask.starterCode[language] ?? "");
    setRunResult(null);
  }, [currentTask, language]);

  // Управление таймером
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerSeconds]);

  const toggleTimer = useCallback(() => {
    setIsTimerRunning((prev) => !prev);
  }, []);

  const resetTimer = useCallback(() => {
    setIsTimerRunning(false);
    setTimerSeconds(DEFAULT_TIMER_SECONDS);
  }, []);

  // Раскрытие подсказок
  const revealNextHint = useCallback(() => {
    if (revealedHints < currentTask.hints.length) {
      setRevealedHints((prev) => prev + 1);
    }
  }, [currentTask.hints.length, revealedHints]);

  // Запуск выполнения решения
  const runCode = useCallback(async () => {
    setIsRunning(true);
    setConsoleTab("tests");
    try {
      const result = await executeCodeInBrowser(code, currentTask, language);
      setRunResult(result);
    } catch (err) {
      console.error("Run error", err);
    } finally {
      setIsRunning(false);
    }
  }, [code, currentTask, language]);

  return {
    tasks,
    currentTask,
    currentTaskId,
    setCurrentTaskId: handleTaskChange,
    language,
    setLanguage: handleLanguageChange,
    theme,
    setTheme,
    code,
    setCode,
    resetCode,
    leftTab,
    setLeftTab,
    consoleTab,
    setConsoleTab,
    notes,
    setNotes,
    revealedHints,
    revealNextHint,
    timerSeconds,
    isTimerRunning,
    toggleTimer,
    resetTimer,
    isRunning,
    runResult,
    runCode,
  };
}
