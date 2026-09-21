import type { LanguageId, Theme } from "@packages/editor";
import { create } from "zustand";
import { MOCK_INTERVIEW_TASKS } from "./tasks";
import type { InterviewTask, RunResult } from "./types";

export const DEFAULT_TIMER_SECONDS = 45 * 60; // 45 минут

export type SandboxLeftTab = "description" | "hints" | "notes";
export type SandboxConsoleTab = "tests" | "logs";

export interface SandboxStoreState {
  // Данные задач и редактора
  tasks: InterviewTask[];
  currentTaskId: string;
  language: LanguageId;
  theme: Theme;
  code: string;
  notes: string;
  revealedHints: number;
  leftTab: SandboxLeftTab;
  consoleTab: SandboxConsoleTab;

  // Состояние таймера
  timerSeconds: number;
  isTimerRunning: boolean;

  // UI состояние видеопанели
  isVideoOpen: boolean;

  // Выполнение кода (резерв)
  isRunning: boolean;
  runResult: RunResult | null;

  // Actions
  getCurrentTask: () => InterviewTask;
  setTaskId: (taskId: string) => void;
  setLanguage: (lang: LanguageId) => string;
  applyRemoteCodeUpdate: (code: string, language?: LanguageId) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setCode: (code: string | ((prev: string) => string)) => void;
  resetCode: () => void;
  setNotes: (notes: string) => void;
  setLeftTab: (tab: SandboxLeftTab) => void;
  setConsoleTab: (tab: SandboxConsoleTab) => void;
  revealNextHint: () => void;
  setTimerSeconds: (seconds: number | ((prev: number) => number)) => void;
  toggleTimer: () => void;
  resetTimer: () => void;
  tickTimer: () => void;
  setIsVideoOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  toggleVideoOpen: () => void;
  setRunResult: (result: RunResult | null) => void;
  setIsRunning: (running: boolean) => void;
  resetStore: () => void;
}

export const useSandboxStore = create<SandboxStoreState>((set, get) => {
  const initialTask = MOCK_INTERVIEW_TASKS[0];
  const initialLanguage: LanguageId = "typescript";
  const initialCode =
    initialTask.starterCode[initialLanguage] ?? "// Начните писать код здесь\n";

  return {
    tasks: MOCK_INTERVIEW_TASKS,
    currentTaskId: initialTask.id,
    language: initialLanguage,
    theme: "dark",
    code: initialCode,
    notes: "",
    revealedHints: 0,
    leftTab: "description",
    consoleTab: "tests",
    timerSeconds: DEFAULT_TIMER_SECONDS,
    isTimerRunning: false,
    isVideoOpen: false,
    isRunning: false,
    runResult: null,

    getCurrentTask: () => {
      const { tasks, currentTaskId } = get();
      return tasks.find((t) => t.id === currentTaskId) ?? tasks[0];
    },

    setTaskId: (taskId: string) => {
      const { tasks, language } = get();
      const targetTask = tasks.find((t) => t.id === taskId) ?? tasks[0];
      set({
        currentTaskId: targetTask.id,
        code: targetTask.starterCode[language] ?? "",
        revealedHints: 0,
      });
    },

    setLanguage: (newLang: LanguageId) => {
      const currentTask = get().getCurrentTask();
      const newCode = currentTask.starterCode[newLang] ?? "";
      set({
        language: newLang,
        code: newCode,
      });
      return newCode;
    },

    applyRemoteCodeUpdate: (code: string, language?: LanguageId) => {
      set((state) => ({
        code,
        ...(language && language !== state.language ? { language } : {}),
      }));
    },

    setTheme: (theme: Theme) => set({ theme }),

    toggleTheme: () =>
      set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),

    setCode: (codeOrUpdater) => {
      if (typeof codeOrUpdater === "function") {
        set((state) => ({ code: codeOrUpdater(state.code) }));
      } else {
        set({ code: codeOrUpdater });
      }
    },

    resetCode: () => {
      const { language } = get();
      const currentTask = get().getCurrentTask();
      set({ code: currentTask.starterCode[language] ?? "" });
    },

    setNotes: (notes: string) => set({ notes }),

    setLeftTab: (tab) => set({ leftTab: tab }),

    setConsoleTab: (tab) => set({ consoleTab: tab }),

    revealNextHint: () => {
      const currentTask = get().getCurrentTask();
      set((state) => ({
        revealedHints:
          state.revealedHints < currentTask.hints.length
            ? state.revealedHints + 1
            : state.revealedHints,
      }));
    },

    setTimerSeconds: (secondsOrUpdater) => {
      if (typeof secondsOrUpdater === "function") {
        set((state) => ({
          timerSeconds: secondsOrUpdater(state.timerSeconds),
        }));
      } else {
        set({ timerSeconds: secondsOrUpdater });
      }
    },

    toggleTimer: () =>
      set((state) => ({ isTimerRunning: !state.isTimerRunning })),

    resetTimer: () =>
      set({
        isTimerRunning: false,
        timerSeconds: DEFAULT_TIMER_SECONDS,
      }),

    tickTimer: () =>
      set((state) => {
        const timerSeconds = Math.max(0, state.timerSeconds - 1);
        return {
          timerSeconds,
          isTimerRunning: timerSeconds > 0 && state.isTimerRunning,
        };
      }),

    setIsVideoOpen: (openOrUpdater) => {
      if (typeof openOrUpdater === "function") {
        set((state) => ({ isVideoOpen: openOrUpdater(state.isVideoOpen) }));
      } else {
        set({ isVideoOpen: openOrUpdater });
      }
    },

    toggleVideoOpen: () =>
      set((state) => ({ isVideoOpen: !state.isVideoOpen })),

    setRunResult: (runResult) => set({ runResult }),

    setIsRunning: (isRunning) => set({ isRunning }),

    resetStore: () => {
      const firstTask = MOCK_INTERVIEW_TASKS[0];
      set({
        tasks: MOCK_INTERVIEW_TASKS,
        currentTaskId: firstTask.id,
        language: "typescript",
        theme: "dark",
        code: firstTask.starterCode.typescript ?? "",
        notes: "",
        revealedHints: 0,
        leftTab: "description",
        consoleTab: "tests",
        timerSeconds: DEFAULT_TIMER_SECONDS,
        isTimerRunning: false,
        isVideoOpen: false,
        isRunning: false,
        runResult: null,
      });
    },
  };
});
