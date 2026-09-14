"use client";

import { useEffect } from "react";
import { useSandboxStore } from "./useSandboxStore";

/**
 * Хук фонового тика таймера в Zustand сторе.
 * Запускается на уровне SandboxRoom и не вызывает ререндер самого SandboxRoom.
 */
export function useSandboxTimer() {
  const isTimerRunning = useSandboxStore((s) => s.isTimerRunning);
  const timerSeconds = useSandboxStore((s) => s.timerSeconds);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        useSandboxStore.getState().tickTimer();
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerSeconds]);
}

/**
 * Адаптер состояния песочницы на базе Zustand.
 * Предоставляет полный интерфейс для обратной совместимости.
 */
export function useSandboxState() {
  const tasks = useSandboxStore((s) => s.tasks);
  const currentTaskId = useSandboxStore((s) => s.currentTaskId);
  const language = useSandboxStore((s) => s.language);
  const theme = useSandboxStore((s) => s.theme);
  const code = useSandboxStore((s) => s.code);
  const leftTab = useSandboxStore((s) => s.leftTab);
  const consoleTab = useSandboxStore((s) => s.consoleTab);
  const notes = useSandboxStore((s) => s.notes);
  const revealedHints = useSandboxStore((s) => s.revealedHints);
  const timerSeconds = useSandboxStore((s) => s.timerSeconds);
  const isTimerRunning = useSandboxStore((s) => s.isTimerRunning);
  const isRunning = useSandboxStore((s) => s.isRunning);
  const runResult = useSandboxStore((s) => s.runResult);

  const getCurrentTask = useSandboxStore((s) => s.getCurrentTask);
  const setTaskId = useSandboxStore((s) => s.setTaskId);
  const setLanguage = useSandboxStore((s) => s.setLanguage);
  const setTheme = useSandboxStore((s) => s.setTheme);
  const setCode = useSandboxStore((s) => s.setCode);
  const resetCode = useSandboxStore((s) => s.resetCode);
  const setLeftTab = useSandboxStore((s) => s.setLeftTab);
  const setConsoleTab = useSandboxStore((s) => s.setConsoleTab);
  const setNotes = useSandboxStore((s) => s.setNotes);
  const revealNextHint = useSandboxStore((s) => s.revealNextHint);
  const toggleTimer = useSandboxStore((s) => s.toggleTimer);
  const resetTimer = useSandboxStore((s) => s.resetTimer);

  useSandboxTimer();

  const currentTask = getCurrentTask();

  return {
    tasks,
    currentTask,
    currentTaskId,
    setCurrentTaskId: setTaskId,
    language,
    setLanguage,
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
    runCode: () => {},
  };
}
