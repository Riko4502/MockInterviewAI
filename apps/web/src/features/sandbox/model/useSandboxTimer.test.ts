import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSandboxTimer } from "./useSandboxState";
import { useSandboxStore } from "./useSandboxStore";

describe("useSandboxTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useSandboxStore.getState().resetStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("не пересоздает интервал при каждом тике таймера", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    useSandboxStore.setState({ isTimerRunning: true, timerSeconds: 10 });

    const { unmount } = renderHook(() => useSandboxTimer());

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy).not.toHaveBeenCalled();

    // Продвигаем время на 3 секунды (3 тика)
    vi.advanceTimersByTime(3000);

    expect(useSandboxStore.getState().timerSeconds).toBe(7);
    // Интервал не должен был пересоздаваться или очищаться между тиками
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy).not.toHaveBeenCalled();

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it("останавливает таймер при isTimerRunning = false", () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    useSandboxStore.setState({ isTimerRunning: true, timerSeconds: 10 });

    const { rerender } = renderHook(() => useSandboxTimer());

    act(() => {
      useSandboxStore.setState({ isTimerRunning: false });
    });
    rerender();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });
});
