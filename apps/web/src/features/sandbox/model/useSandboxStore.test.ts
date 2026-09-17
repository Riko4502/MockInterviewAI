import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_TIMER_SECONDS, useSandboxStore } from "./useSandboxStore";

describe("useSandboxStore", () => {
  beforeEach(() => {
    useSandboxStore.getState().resetStore();
  });

  it("should initialize with default state", () => {
    const state = useSandboxStore.getState();
    expect(state.currentTaskId).toBe("two-sum");
    expect(state.language).toBe("typescript");
    expect(state.theme).toBe("dark");
    expect(state.timerSeconds).toBe(DEFAULT_TIMER_SECONDS);
    expect(state.isTimerRunning).toBe(false);
    expect(state.isVideoOpen).toBe(false);
  });

  it("should switch task and reset hints", () => {
    const { setTaskId, revealNextHint } = useSandboxStore.getState();
    revealNextHint();
    expect(useSandboxStore.getState().revealedHints).toBe(1);

    setTaskId("valid-palindrome");
    const state = useSandboxStore.getState();
    expect(state.currentTaskId).toBe("valid-palindrome");
    expect(state.revealedHints).toBe(0);
    expect(state.code).toContain("isPalindrome");
  });

  it("should fallback to default task and save target task id when taskId is unknown", () => {
    const { setTaskId, tasks } = useSandboxStore.getState();
    setTaskId("unknown-non-existent-task-id");
    const state = useSandboxStore.getState();
    expect(state.currentTaskId).toBe(tasks[0].id);
    expect(state.code).toBe(tasks[0].starterCode.typescript ?? "");
  });

  it("should switch language, update starter code and return new code", () => {
    const { setLanguage } = useSandboxStore.getState();
    const newCode = setLanguage("python");
    const state = useSandboxStore.getState();
    expect(state.language).toBe("python");
    expect(state.code).toContain("def twoSum");
    expect(newCode).toBe(state.code);
  });

  it("should return empty string and not fallback to typescript when template is missing", () => {
    const { setLanguage, tasks } = useSandboxStore.getState();
    // Имитируем задачу без шаблона для определенного языка
    delete tasks[0].starterCode.go;
    const newCode = setLanguage("go");
    const state = useSandboxStore.getState();
    expect(state.language).toBe("go");
    expect(state.code).toBe("");
    expect(newCode).toBe("");
  });

  it("should apply remote code update with new language without resetting to starter code", () => {
    const { applyRemoteCodeUpdate } = useSandboxStore.getState();
    const customPythonCode = "def myCustomSolution():\n    return 42";

    applyRemoteCodeUpdate(customPythonCode, "python");
    const state = useSandboxStore.getState();
    expect(state.language).toBe("python");
    expect(state.code).toBe(customPythonCode);
  });

  it("should toggle timer and decrement on tick", () => {
    const { toggleTimer, tickTimer } = useSandboxStore.getState();
    expect(useSandboxStore.getState().isTimerRunning).toBe(false);

    toggleTimer();
    expect(useSandboxStore.getState().isTimerRunning).toBe(true);

    tickTimer();
    expect(useSandboxStore.getState().timerSeconds).toBe(
      DEFAULT_TIMER_SECONDS - 1,
    );

    useSandboxStore.getState().resetTimer();
    expect(useSandboxStore.getState().isTimerRunning).toBe(false);
    expect(useSandboxStore.getState().timerSeconds).toBe(DEFAULT_TIMER_SECONDS);

    // Проверяем остановку таймера при достижении нуля
    useSandboxStore.setState({ timerSeconds: 1, isTimerRunning: true });
    tickTimer();
    expect(useSandboxStore.getState().timerSeconds).toBe(0);
    expect(useSandboxStore.getState().isTimerRunning).toBe(false);
  });

  it("should toggle theme and video panel visibility", () => {
    const { toggleTheme, toggleVideoOpen } = useSandboxStore.getState();
    expect(useSandboxStore.getState().theme).toBe("dark");
    toggleTheme();
    expect(useSandboxStore.getState().theme).toBe("light");

    expect(useSandboxStore.getState().isVideoOpen).toBe(false);
    toggleVideoOpen();
    expect(useSandboxStore.getState().isVideoOpen).toBe(true);
  });
});
