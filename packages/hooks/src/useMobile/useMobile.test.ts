import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIsMobile, useMobile } from "./useMobile";

describe("useMobile", () => {
  let listeners: ((event: unknown) => void)[] = [];
  let matches = false;

  beforeEach(() => {
    listeners = [];
    matches = false;
    window.innerWidth = 1024;

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn((event: string, cb: (e: unknown) => void) => {
          if (event === "change") {
            listeners.push(cb);
          }
        }),
        removeEventListener: vi.fn(
          (event: string, cb: (e: unknown) => void) => {
            if (event === "change") {
              listeners = listeners.filter((l) => l !== cb);
            }
          },
        ),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("возвращает false для десктопного экрана", () => {
    window.innerWidth = 1024;
    matches = false;

    const { result } = renderHook(() => useMobile());
    expect(result.current).toBe(false);
  });

  it("возвращает true, если ширина окна меньше 768px", () => {
    window.innerWidth = 500;

    const { result } = renderHook(() => useMobile());
    expect(result.current).toBe(true);
  });

  it("возвращает true, если media query matches = true", () => {
    window.innerWidth = 1024;
    matches = true;

    const { result } = renderHook(() => useMobile());
    expect(result.current).toBe(true);
  });

  it("реагирует на события изменения mediaQuery", () => {
    window.innerWidth = 1024;
    matches = false;

    const { result } = renderHook(() => useMobile());
    expect(result.current).toBe(false);

    act(() => {
      window.innerWidth = 600;
      for (const cb of listeners) {
        cb({ matches: true });
      }
    });

    expect(result.current).toBe(true);
  });

  it("поддерживает кастомный брейкпоинт", () => {
    window.innerWidth = 900;
    matches = false;

    const { result: defaultBreakpoint } = renderHook(() => useMobile(768));
    expect(defaultBreakpoint.current).toBe(false);

    const { result: customBreakpoint } = renderHook(() => useMobile(1000));
    expect(customBreakpoint.current).toBe(true);
  });

  it("удаляет слушатели событий при размонтировании", () => {
    const { unmount } = renderHook(() => useMobile());
    expect(listeners.length).toBe(1);

    unmount();
    expect(listeners.length).toBe(0);
  });

  it("useIsMobile работает как алиас для useMobile", () => {
    window.innerWidth = 500;

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });
});
