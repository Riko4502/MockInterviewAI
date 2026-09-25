import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWebRTC } from "./useWebRTC";

describe("useWebRTC screen sharing track lifecycle", () => {
  let mockScreenTrack: {
    kind: string;
    stop: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
  };
  let mockCameraTrack: {
    kind: string;
    stop: ReturnType<typeof vi.fn>;
  };
  let mockAudioTrack: {
    kind: string;
    stop: ReturnType<typeof vi.fn>;
  };
  let mockVideoSender: {
    track: { kind: string };
    replaceTrack: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockScreenTrack = {
      kind: "video",
      stop: vi.fn(),
      onended: null,
    };
    mockCameraTrack = {
      kind: "video",
      stop: vi.fn(),
    };
    mockAudioTrack = {
      kind: "audio",
      stop: vi.fn(),
    };

    mockVideoSender = {
      track: { kind: "video" },
      replaceTrack: vi.fn().mockResolvedValue(undefined),
    };

    // Mock getUserMedia
    const fakeCameraStream = {
      getTracks: () => [mockCameraTrack, mockAudioTrack],
      getVideoTracks: () => [mockCameraTrack],
      getAudioTracks: () => [mockAudioTrack],
      removeTrack: vi.fn(),
      addTrack: vi.fn(),
    } as unknown as MediaStream;

    // Mock getDisplayMedia
    const fakeScreenStream = {
      getTracks: () => [mockScreenTrack],
      getVideoTracks: () => [mockScreenTrack],
    } as unknown as MediaStream;

    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(fakeCameraStream),
        getDisplayMedia: vi.fn().mockResolvedValue(fakeScreenStream),
      },
      configurable: true,
      writable: true,
    });

    // Mock RTCPeerConnection
    class MockRTCPeerConnection {
      onicecandidate: ((e: unknown) => void) | null = null;
      ontrack: ((e: unknown) => void) | null = null;
      onconnectionstatechange: (() => void) | null = null;
      connectionState = "new";

      addTrack = vi.fn();
      createOffer = vi
        .fn()
        .mockResolvedValue({ type: "offer", sdp: "dummy-sdp" });
      setLocalDescription = vi.fn().mockResolvedValue(undefined);
      getSenders = vi.fn().mockReturnValue([mockVideoSender]);
      close = vi.fn();
    }

    vi.stubGlobal("RTCPeerConnection", MockRTCPeerConnection);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("останавливает screenTrack при выключении демонстрации экрана из UI", async () => {
    const onSendSignal = vi.fn();
    const { result } = renderHook(() =>
      useWebRTC({ userId: "user-1", onSendSignal }),
    );

    // Запускаем звонок, чтобы создать pcRef и localStream
    await act(async () => {
      await result.current.startCall();
    });

    // Включаем демонстрацию экрана
    await act(async () => {
      await result.current.toggleScreenShare();
    });

    expect(result.current.isScreenSharing).toBe(true);
    expect(mockVideoSender.replaceTrack).toHaveBeenCalledWith(mockScreenTrack);
    expect(mockScreenTrack.stop).not.toHaveBeenCalled();

    // Выключаем демонстрацию экрана через повторный вызов toggleScreenShare
    await act(async () => {
      await result.current.toggleScreenShare();
    });

    expect(result.current.isScreenSharing).toBe(false);
    expect(mockScreenTrack.stop).toHaveBeenCalledTimes(1);
  });

  it("останавливает screenTrack при завершении звонка через endCall", async () => {
    const onSendSignal = vi.fn();
    const { result } = renderHook(() =>
      useWebRTC({ userId: "user-1", onSendSignal }),
    );

    await act(async () => {
      await result.current.startCall();
    });

    await act(async () => {
      await result.current.toggleScreenShare();
    });

    expect(result.current.isScreenSharing).toBe(true);
    expect(mockScreenTrack.stop).not.toHaveBeenCalled();

    // Завершаем звонок
    act(() => {
      result.current.endCall();
    });

    expect(mockScreenTrack.stop).toHaveBeenCalledTimes(1);
  });

  it("останавливает screenTrack при размонтировании хука", async () => {
    const onSendSignal = vi.fn();
    const { result, unmount } = renderHook(() =>
      useWebRTC({ userId: "user-1", onSendSignal }),
    );

    await act(async () => {
      await result.current.startCall();
    });

    await act(async () => {
      await result.current.toggleScreenShare();
    });

    expect(result.current.isScreenSharing).toBe(true);
    expect(mockScreenTrack.stop).not.toHaveBeenCalled();

    // Размонтируем компонент
    unmount();

    expect(mockScreenTrack.stop).toHaveBeenCalledTimes(1);
  });

  it("динамически переключает аудиоустройство через switchAudioDevice", async () => {
    const onSendSignal = vi.fn();
    const { result } = renderHook(() =>
      useWebRTC({ userId: "user-1", onSendSignal }),
    );

    await act(async () => {
      await result.current.startCall();
    });

    await act(async () => {
      await result.current.switchAudioDevice("new-mic-id");
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: {
          deviceId: { exact: "new-mic-id" },
          echoCancellation: true,
          noiseSuppression: true,
        },
      }),
    );
  });

  it("динамически переключает видеоустройство через switchVideoDevice", async () => {
    const onSendSignal = vi.fn();
    const { result } = renderHook(() =>
      useWebRTC({ userId: "user-1", onSendSignal }),
    );

    await act(async () => {
      await result.current.startCall();
    });

    await act(async () => {
      await result.current.switchVideoDevice("new-cam-id");
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        video: {
          deviceId: { exact: "new-cam-id" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      }),
    );
  });

  it("реактивно переключает на микрофон по умолчанию при смене audioDeviceId на пустую строку", async () => {
    const onSendSignal = vi.fn();
    const { result, rerender } = renderHook(
      ({ audioDeviceId }: { audioDeviceId: string }) =>
        useWebRTC({ userId: "user-1", onSendSignal, audioDeviceId }),
      {
        initialProps: { audioDeviceId: "custom-mic" },
      },
    );

    await act(async () => {
      await result.current.startCall();
    });

    vi.mocked(navigator.mediaDevices.getUserMedia).mockClear();

    rerender({ audioDeviceId: "" });

    await act(async () => {
      await Promise.resolve();
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      }),
    );
  });

  it("реактивно переключает на камеру по умолчанию при смене videoDeviceId на пустую строку", async () => {
    const onSendSignal = vi.fn();
    const { result, rerender } = renderHook(
      ({ videoDeviceId }: { videoDeviceId: string }) =>
        useWebRTC({ userId: "user-1", onSendSignal, videoDeviceId }),
      {
        initialProps: { videoDeviceId: "custom-cam" },
      },
    );

    await act(async () => {
      await result.current.startCall();
    });

    vi.mocked(navigator.mediaDevices.getUserMedia).mockClear();

    rerender({ videoDeviceId: "" });

    await act(async () => {
      await Promise.resolve();
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      }),
    );
  });
});
