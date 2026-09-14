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

  it("should switch language and update starter code", () => {
    const { setLanguage } = useSandboxStore.getState();
    setLanguage("python");
    const state = useSandboxStore.getState();
    expect(state.language).toBe("python");
    expect(state.code).toContain("def twoSum");
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
