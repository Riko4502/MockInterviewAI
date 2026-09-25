import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MEDIA_SETTINGS } from "./mediaSettingsStorage";
import { useMediaSettings } from "./useMediaSettings";

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
});
