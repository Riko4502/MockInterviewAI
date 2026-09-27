import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLocalStorage } from "./useLocalStorage";

describe("useLocalStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("возвращает initialValue, если в localStorage пусто", () => {
    const { result } = renderHook(() =>
      useLocalStorage("test-key", "default-value"),
    );
    expect(result.current[0]).toBe("default-value");
  });

  it("поддерживает ленивую инициализацию через функцию", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", () => 42));
    expect(result.current[0]).toBe(42);
  });

  it("считывает существующее значение из localStorage при инициализации", () => {
    window.localStorage.setItem("test-key", JSON.stringify("stored-value"));

    const { result } = renderHook(() =>
      useLocalStorage("test-key", "default-value"),
    );
    expect(result.current[0]).toBe("stored-value");
  });

  it("обновляет значение в состоянии и в localStorage", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", "initial"));

    act(() => {
      result.current[1]("updated");
    });

    expect(result.current[0]).toBe("updated");
    const stored = window.localStorage.getItem("test-key");
    expect(stored ? JSON.parse(stored) : null).toBe("updated");
  });

  it("поддерживает функциональное обновление setValue(prev => !prev)", () => {
    const { result } = renderHook(() => useLocalStorage("bool-key", false));

    act(() => {
      result.current[1]((prev) => !prev);
    });

    expect(result.current[0]).toBe(true);
    const stored = window.localStorage.getItem("bool-key");
    expect(stored ? JSON.parse(stored) : null).toBe(true);
  });

  it("удаляет значение и сбрасывает в initialValue при вызове removeValue", () => {
    const { result } = renderHook(() => useLocalStorage("remove-key", "init"));

    act(() => {
      result.current[1]("changed");
    });
    expect(result.current[0]).toBe("changed");

    act(() => {
      result.current[2]();
    });

    expect(result.current[0]).toBe("init");
    expect(window.localStorage.getItem("remove-key")).toBeNull();
  });

  it("синхронизирует состояние между двумя хуками с одинаковым ключом (CustomEvent)", () => {
    const { result: hook1 } = renderHook(() =>
      useLocalStorage("sync-key", "one"),
    );
    const { result: hook2 } = renderHook(() =>
      useLocalStorage("sync-key", "one"),
    );

    act(() => {
      hook1.current[1]("two");
    });

    expect(hook1.current[0]).toBe("two");
    expect(hook2.current[0]).toBe("two");
  });

  it("обрабатывает некорректный JSON в localStorage без падения", () => {
    window.localStorage.setItem("broken-key", "not-a-valid-json{");

    const { result } = renderHook(() =>
      useLocalStorage("broken-key", "fallback"),
    );
    expect(result.current[0]).toBe("fallback");
  });

  it("поддерживает несколько последовательных функциональных обновлений до следующего рендера", () => {
    const { result } = renderHook(() => useLocalStorage("counter-key", 0));

    act(() => {
      result.current[1]((prev) => prev + 1);
      result.current[1]((prev) => prev + 1);
    });

    expect(result.current[0]).toBe(2);
    expect(window.localStorage.getItem("counter-key")).toBe("2");
  });

  it("не изменяет состояние при ошибке записи в localStorage", () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

    const { result } = renderHook(() =>
      useLocalStorage("error-key", "initial"),
    );

    act(() => {
      result.current[1]("new-value");
    });

    expect(result.current[0]).toBe("initial");
    setItemSpy.mockRestore();
  });

  it("поддерживает функциональное обновление сразу после removeValue в одном act", () => {
    const { result } = renderHook(() => useLocalStorage("counter-key", 0));

    act(() => {
      result.current[1](1);
    });
    expect(result.current[0]).toBe(1);

    act(() => {
      result.current[2]();
      result.current[1]((prev) => prev + 1);
    });

    expect(result.current[0]).toBe(1);
    expect(window.localStorage.getItem("counter-key")).toBe("1");
  });
});
