import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionContext } from "@/entities/session/model/context";
import { DEFAULT_MEDIA_SETTINGS } from "./mediaSettingsStorage";
import {
  clearDeviceSyncQueuesForTesting,
  useMediaSettings,
} from "./useMediaSettings";

let mockCurrentUser: { id: string } | undefined;

vi.mock("@/entities/user", () => ({
  useCurrentUser: () => ({
    data: mockCurrentUser,
  }),
}));

let mockServerSettings: {
  isPersisted?: boolean;
  audioVolume?: number;
  speechVolume?: number;
  micGain?: number;
  preferredAudioInputLabel?: string | null;
  preferredAudioOutputLabel?: string | null;
  preferredVideoInputLabel?: string | null;
} | null = null;

let mockIsFetchingServerSettings = false;
const mockUpdateMutationState = { isPending: false };
const mutateMock = vi.fn();

vi.mock("@packages/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@packages/api")>();
  return {
    ...actual,
    useProfileControllerGetDeviceSettings: () => ({
      data: mockServerSettings,
      isFetching: mockIsFetchingServerSettings,
    }),
    useProfileControllerUpdateDeviceSettings: () => ({
      mutate: mutateMock,
      get isPending() {
        return mockUpdateMutationState.isPending;
      },
    }),
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function createAuthenticatedWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        SessionContext.Provider,
        {
          value: {
            isAuthenticated: true,
            status: "authenticated",
            startSession: vi.fn(),
            clearSession: vi.fn(),
          },
        },
        children,
      ),
    );
}

describe("useMediaSettings", () => {
  beforeEach(() => {
    localStorage.clear();
    clearDeviceSyncQueuesForTesting();
    mockCurrentUser = undefined;
    mockServerSettings = null;
    mockIsFetchingServerSettings = false;
    mockUpdateMutationState.isPending = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns default settings initially", () => {
    const { result } = renderHook(() => useMediaSettings(), {
      wrapper: createWrapper(),
    });

    expect(result.current.audioVolume).toBe(DEFAULT_MEDIA_SETTINGS.audioVolume);
    expect(result.current.speechVolume).toBe(
      DEFAULT_MEDIA_SETTINGS.speechVolume,
    );
    expect(result.current.micGain).toBe(DEFAULT_MEDIA_SETTINGS.micGain);
    expect(result.current.audioInputId).toBe("");
    expect(result.current.audioOutputId).toBe("");
    expect(result.current.videoInputId).toBe("");
  });

  it("updates and clamps volumes within [0, 100]", () => {
    const { result } = renderHook(() => useMediaSettings(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setAudioVolume(65);
    });
    expect(result.current.audioVolume).toBe(65);

    act(() => {
      result.current.setAudioVolume(150); // Clamped
    });
    expect(result.current.audioVolume).toBe(100);

    act(() => {
      result.current.setAudioVolume(-20); // Clamped
    });
    expect(result.current.audioVolume).toBe(0);

    act(() => {
      result.current.setSpeechVolume(42);
    });
    expect(result.current.speechVolume).toBe(42);

    act(() => {
      result.current.setMicGain(95);
    });
    expect(result.current.micGain).toBe(95);
  });

  it("updates device IDs and stores them in localStorage", () => {
    const { result } = renderHook(() => useMediaSettings(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setAudioInputId("mic-usb-1");
      result.current.setAudioOutputId("headphones-2");
      result.current.setVideoInputId("webcam-hd-3");
    });

    expect(result.current.audioInputId).toBe("mic-usb-1");
    expect(result.current.audioOutputId).toBe("headphones-2");
    expect(result.current.videoInputId).toBe("webcam-hd-3");

    const stored = JSON.parse(
      localStorage.getItem("mockinterview_media_settings") || "{}",
    );
    expect(stored.audioInputId).toBe("mic-usb-1");
    expect(stored.audioOutputId).toBe("headphones-2");
    expect(stored.videoInputId).toBe("webcam-hd-3");
  });

  it("triggers playTestSound without error", () => {
    const { result } = renderHook(() => useMediaSettings(), {
      wrapper: createWrapper(),
    });

    expect(() => {
      act(() => {
        result.current.playTestSound();
      });
    }).not.toThrow();
  });

  it("does not apply stale GET over pending local changes (debounced PUT)", () => {
    mockServerSettings = {
      isPersisted: true,
      audioVolume: 40,
      speechVolume: 40,
      micGain: 40,
    };
    mockIsFetchingServerSettings = false;
    mockUpdateMutationState.isPending = false;

    const { result, rerender } = renderHook(() => useMediaSettings(), {
      wrapper: createAuthenticatedWrapper(),
    });

    // Пользователь меняет громкость на 80
    act(() => {
      result.current.setAudioVolume(80);
    });
    expect(result.current.audioVolume).toBe(80);

    // Приходит фоновый GET со старыми настройками (40), пока локальный PUT ещё в дебаунсе
    mockServerSettings = {
      isPersisted: true,
      audioVolume: 40,
      speechVolume: 40,
      micGain: 40,
    };
    rerender();

    // Значение НЕ должно сброситься обратно на 40
    expect(result.current.audioVolume).toBe(80);
  });

  it("does not apply stale GET while PUT is in flight, and preserves 90 after both complete", () => {
    vi.useFakeTimers();

    // 1. Исходные настройки на сервере (35)
    mockServerSettings = {
      isPersisted: true,
      audioVolume: 35,
      speechVolume: 35,
      micGain: 35,
    };
    mockIsFetchingServerSettings = false;
    mockUpdateMutationState.isPending = false;

    let completePut = () => {};
    mutateMock.mockImplementationOnce((variables, options) => {
      completePut = () => {
        mockUpdateMutationState.isPending = false;
        options?.onSuccess?.({ ...variables.data, isPersisted: true });
        options?.onSettled?.();
      };
    });

    const { result, rerender } = renderHook(() => useMediaSettings(), {
      wrapper: createAuthenticatedWrapper(),
    });

    rerender();
    expect(result.current.audioVolume).toBe(35);

    // 2. Пользователь меняет громкость на 90
    act(() => {
      result.current.setAudioVolume(90);
    });
    expect(result.current.audioVolume).toBe(90);

    // 3. Запускаем PUT после дебаунса 400мс
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock.mock.calls[0][0].data.audioVolume).toBe(90);

    // PUT сейчас выполняется (in-flight)
    mockUpdateMutationState.isPending = true;

    // 4. Во время выполнения PUT приходит фоновый GET со старыми данными (35)
    mockIsFetchingServerSettings = true;
    rerender();

    mockIsFetchingServerSettings = false;
    mockServerSettings = {
      isPersisted: true,
      audioVolume: 35,
      speechVolume: 35,
      micGain: 35,
    };
    rerender();

    // Старый ответ GET не должен перезаписать актуальные 90
    expect(result.current.audioVolume).toBe(90);

    // 5. Завершаем выполнение PUT
    act(() => {
      completePut();
    });

    // 6. Приходит обновлённый GET со значением 90 после завершения PUT
    mockServerSettings = {
      isPersisted: true,
      audioVolume: 90,
      speechVolume: 35,
      micGain: 35,
    };
    rerender();

    // Значение 90 сохранено после завершения обоих запросов
    expect(result.current.audioVolume).toBe(90);

    vi.useRealTimers();
  });

  it("serializes PUT requests: waits for in-flight PUT to complete before sending next snapshot", () => {
    vi.useFakeTimers();

    let completeFirstPut = () => {};
    mutateMock.mockImplementationOnce((_variables, options) => {
      completeFirstPut = () => {
        options?.onSuccess?.({ ..._variables.data, isPersisted: true });
        options?.onSettled?.();
      };
    });

    const { result } = renderHook(() => useMediaSettings(), {
      wrapper: createAuthenticatedWrapper(),
    });

    // Первое изменение
    act(() => {
      result.current.setAudioVolume(50);
    });

    // Проходит дебаунс первого изменения -> запускается первый PUT
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock.mock.calls[0][0].data.audioVolume).toBe(50);

    // Второе изменение, пока первый PUT всё ещё выполняется
    act(() => {
      result.current.setAudioVolume(70);
    });

    // Проходит дебаунс второго изменения (400мс)
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Второй PUT НЕ должен запуститься параллельно с первым!
    expect(mutateMock).toHaveBeenCalledTimes(1);

    // Завершаем первый PUT
    act(() => {
      completeFirstPut();
    });

    // Теперь второй PUT должен запуститься с актуальными настройками
    expect(mutateMock).toHaveBeenCalledTimes(2);
    expect(mutateMock.mock.calls[1][0].data.audioVolume).toBe(70);

    vi.useRealTimers();
  });

  it("merges intermediate snapshots: sends only the latest snapshot when multiple changes occur while PUT is in flight", () => {
    vi.useFakeTimers();

    let completeFirstPut = () => {};
    mutateMock.mockImplementationOnce((_variables, options) => {
      completeFirstPut = () => {
        options?.onSuccess?.({ ..._variables.data, isPersisted: true });
        options?.onSettled?.();
      };
    });

    const { result } = renderHook(() => useMediaSettings(), {
      wrapper: createAuthenticatedWrapper(),
    });

    // Стартовое изменение
    act(() => {
      result.current.setAudioVolume(40);
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock.mock.calls[0][0].data.audioVolume).toBe(40);

    // Серия быстрых изменений во время выполнения первого PUT
    act(() => {
      result.current.setAudioVolume(55);
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.setAudioVolume(65);
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.setAudioVolume(85);
    });

    // Дожидаемся истечения дебаунса для последнего изменения (85)
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Второй PUT не отправляется, пока первый не завершён
    expect(mutateMock).toHaveBeenCalledTimes(1);

    // Завершаем первый PUT
    act(() => {
      completeFirstPut();
    });

    // Должен быть отправлен только последний снимок (85), промежуточные 55 и 65 пропущены
    expect(mutateMock).toHaveBeenCalledTimes(2);
    expect(mutateMock.mock.calls[1][0].data.audioVolume).toBe(85);

    vi.useRealTimers();
  });

  it("waits for debounce timer if previous PUT finishes while debounce is still active", () => {
    vi.useFakeTimers();

    let completeFirstPut = () => {};
    mutateMock.mockImplementationOnce((_variables, options) => {
      completeFirstPut = () => {
        options?.onSuccess?.({ ..._variables.data, isPersisted: true });
        options?.onSettled?.();
      };
    });

    const { result } = renderHook(() => useMediaSettings(), {
      wrapper: createAuthenticatedWrapper(),
    });

    act(() => {
      result.current.setAudioVolume(30);
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(mutateMock).toHaveBeenCalledTimes(1);

    // Пользователь меняет громкость
    act(() => {
      result.current.setAudioVolume(75);
    });

    // Первый PUT завершается через 100мс (дебаунс второго изменения ещё не истёк, осталось 300мс)
    act(() => {
      vi.advanceTimersByTime(100);
      completeFirstPut();
    });

    // Второй PUT НЕ должен отправиться раньше окончания дебаунса
    expect(mutateMock).toHaveBeenCalledTimes(1);

    // Дожидаемся оставшихся 300мс дебаунса
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mutateMock).toHaveBeenCalledTimes(2);
    expect(mutateMock.mock.calls[1][0].data.audioVolume).toBe(75);

    vi.useRealTimers();
  });

  it("continues processing queue even if the previous PUT fails with error", () => {
    vi.useFakeTimers();

    let failFirstPut = () => {};
    mutateMock.mockImplementationOnce((_variables, options) => {
      failFirstPut = () => {
        options?.onError?.(new Error("Network error"));
        options?.onSettled?.();
      };
    });

    const { result } = renderHook(() => useMediaSettings(), {
      wrapper: createAuthenticatedWrapper(),
    });

    act(() => {
      result.current.setAudioVolume(20);
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(mutateMock).toHaveBeenCalledTimes(1);

    // Новое изменение во время первого PUT
    act(() => {
      result.current.setAudioVolume(95);
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Первый PUT падает с ошибкой
    act(() => {
      failFirstPut();
    });

    // Очередь должна продолжить работу и отправить отложенный снимок 95
    expect(mutateMock).toHaveBeenCalledTimes(2);
    expect(mutateMock.mock.calls[1][0].data.audioVolume).toBe(95);

    vi.useRealTimers();
  });

  it("preserves pending sync and initialSyncDone when userId transitions from undefined to current user", () => {
    vi.useFakeTimers();

    mockCurrentUser = undefined;
    mockServerSettings = {
      isPersisted: false,
    };

    const { rerender } = renderHook(() => useMediaSettings(), {
      wrapper: createAuthenticatedWrapper(),
    });

    // На сервере нет настроек -> был запланирован initialSync
    // Теперь currentUser загрузился и вернул id пользователя
    mockCurrentUser = { id: "user-456" };
    rerender();

    // Проходит дебаунс (400мс)
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // PUT должен успешно выполниться и не быть стёрт эффектом смены userId
    expect(mutateMock).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("flushes pending snapshot on unmount when debounce timer is active", () => {
    vi.useFakeTimers();

    const { result, unmount } = renderHook(() => useMediaSettings(), {
      wrapper: createAuthenticatedWrapper(),
    });

    act(() => {
      result.current.setAudioVolume(65);
    });

    // Дебаунс 400мс ещё не истёк (прошло только 50мс)
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(mutateMock).not.toHaveBeenCalled();

    // Размонтируем хук (например, закрытие диалога настроек)
    unmount();

    // Запланированный PUT не должен потеряться — он должен быть отправлен на сервер!
    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock.mock.calls[0][0].data.audioVolume).toBe(65);

    vi.useRealTimers();
  });

  it("survives unmount and sends queued snapshot after in-flight PUT completes", () => {
    vi.useFakeTimers();

    let completeFirstPut = () => {};
    mutateMock.mockImplementationOnce((_variables, options) => {
      completeFirstPut = () => {
        options?.onSuccess?.({ ..._variables.data, isPersisted: true });
        options?.onSettled?.();
      };
    });

    const { result, unmount } = renderHook(() => useMediaSettings(), {
      wrapper: createAuthenticatedWrapper(),
    });

    // Запускаем первый PUT
    act(() => {
      result.current.setAudioVolume(40);
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(mutateMock).toHaveBeenCalledTimes(1);

    // Во время первого PUT пользователь меняет громкость на 82
    act(() => {
      result.current.setAudioVolume(82);
    });

    // Размонтируем компонент пока первый PUT ещё в полёте
    unmount();

    // Второй PUT пока не запускается (ждёт окончания первого)
    expect(mutateMock).toHaveBeenCalledTimes(1);

    // Завершаем первый PUT
    act(() => {
      completeFirstPut();
    });

    // Очередь устройства пережила размонтирование и отправила отложенный снимок 82!
    expect(mutateMock).toHaveBeenCalledTimes(2);
    expect(mutateMock.mock.calls[1][0].data.audioVolume).toBe(82);

    vi.useRealTimers();
  });
});
