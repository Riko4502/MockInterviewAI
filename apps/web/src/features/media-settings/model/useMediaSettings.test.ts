import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionContext } from "@/entities/session/model/context";
import { DEFAULT_MEDIA_SETTINGS } from "./mediaSettingsStorage";
import { useMediaSettings } from "./useMediaSettings";

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
    vi.clearAllMocks();
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

  it("does not apply stale GET while PUT is in flight (mutation is pending)", () => {
    mockServerSettings = {
      isPersisted: true,
      audioVolume: 35,
      speechVolume: 35,
      micGain: 35,
    };
    mockIsFetchingServerSettings = false;
    mockUpdateMutationState.isPending = true;

    const { result, rerender } = renderHook(() => useMediaSettings(), {
      wrapper: createAuthenticatedWrapper(),
    });

    act(() => {
      result.current.setAudioVolume(90);
    });
    expect(result.current.audioVolume).toBe(90);

    rerender();
    expect(result.current.audioVolume).toBe(90);
  });
});
