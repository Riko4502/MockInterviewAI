import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMicLevelMeter } from "./useMicLevelMeter";

describe("useMicLevelMeter", () => {
  let mockGainNode: {
    gain: { value: number };
    connect: ReturnType<typeof vi.fn>;
  };
  let mockAnalyser: {
    fftSize: number;
    smoothingTimeConstant: number;
    connect: ReturnType<typeof vi.fn>;
    frequencyBinCount: number;
    getByteFrequencyData: ReturnType<typeof vi.fn>;
  };
  let mockSource: {
    connect: ReturnType<typeof vi.fn>;
  };
  let mockTrack: { stop: ReturnType<typeof vi.fn> };
  let mockStream: {
    getTracks: () => Array<{ stop: ReturnType<typeof vi.fn> }>;
  };
  let getUserMediaMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockTrack = { stop: vi.fn() };
    mockStream = { getTracks: () => [mockTrack] };

    getUserMediaMock = vi.fn().mockResolvedValue(mockStream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: getUserMediaMock },
      configurable: true,
      writable: true,
    });

    mockGainNode = {
      gain: { value: 1 },
      connect: vi.fn(),
    };

    mockAnalyser = {
      fftSize: 256,
      smoothingTimeConstant: 0.4,
      connect: vi.fn(),
      frequencyBinCount: 128,
      getByteFrequencyData: vi.fn((arr: Uint8Array) => arr.fill(50)),
    };

    mockSource = {
      connect: vi.fn(),
    };

    class MockAudioContext {
      createMediaStreamSource = vi.fn().mockReturnValue(mockSource);
      createGain = vi.fn().mockReturnValue(mockGainNode);
      createAnalyser = vi.fn().mockReturnValue(mockAnalyser);
      close = vi.fn().mockResolvedValue(undefined);
      state = "running";
    }

    window.AudioContext = MockAudioContext as unknown as typeof AudioContext;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("не вызывает getUserMedia повторно при изменении gain и обновляет gainNode.gain.value", async () => {
    const { rerender } = renderHook(
      ({ gain }: { gain: number }) => useMicLevelMeter("mic-1", true, gain),
      {
        initialProps: { gain: 80 },
      },
    );

    // Даем промису getUserMedia разрешиться
    await act(async () => {
      await Promise.resolve();
    });

    expect(getUserMediaMock).toHaveBeenCalledTimes(1);
    expect(mockGainNode.gain.value).toBe(0.8);

    // Изменяем gain (симуляция движения ползунка)
    rerender({ gain: 50 });

    // getUserMedia НЕ должен быть вызван повторно
    expect(getUserMediaMock).toHaveBeenCalledTimes(1);
    expect(mockGainNode.gain.value).toBe(0.5);

    rerender({ gain: 100 });
    expect(getUserMediaMock).toHaveBeenCalledTimes(1);
    expect(mockGainNode.gain.value).toBe(1);
  });

  it("применяет актуальный gain, если gain изменился до завершения асинхронного захвата", async () => {
    let resolveStream!: (stream: unknown) => void;
    getUserMediaMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStream = resolve;
        }),
    );

    const { rerender } = renderHook(
      ({ gain }: { gain: number }) => useMicLevelMeter("mic-1", true, gain),
      {
        initialProps: { gain: 60 },
      },
    );

    expect(getUserMediaMock).toHaveBeenCalledTimes(1);

    // Пользователь изменил ползунок, пока getUserMedia ещё ожидал ответа
    rerender({ gain: 90 });

    // Теперь разрешаем поток
    await act(async () => {
      resolveStream(mockStream);
      await Promise.resolve();
    });

    // Должно примениться последнее значение 90% (0.9), а не устаревшее 60%
    expect(mockGainNode.gain.value).toBe(0.9);
  });

  it("перезахватывает поток при смене deviceId", async () => {
    const { rerender } = renderHook(
      ({ deviceId }: { deviceId: string }) =>
        useMicLevelMeter(deviceId, true, 80),
      {
        initialProps: { deviceId: "mic-1" },
      },
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(getUserMediaMock).toHaveBeenCalledTimes(1);

    rerender({ deviceId: "mic-2" });

    await act(async () => {
      await Promise.resolve();
    });

    expect(getUserMediaMock).toHaveBeenCalledTimes(2);
  });
});
