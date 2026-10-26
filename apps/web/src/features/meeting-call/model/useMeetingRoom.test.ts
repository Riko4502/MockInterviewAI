import { act, renderHook } from "@testing-library/react";
import { ConnectionState } from "livekit-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMeetingRoom } from "./useMeetingRoom";

const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockDisconnect = vi.fn().mockResolvedValue(undefined);
const mockSwitchActiveDevice = vi.fn().mockResolvedValue(true);
const mockSetMicrophoneEnabled = vi.fn().mockResolvedValue(undefined);
const mockSetCameraEnabled = vi.fn().mockResolvedValue(undefined);
const mockSetScreenShareEnabled = vi.fn().mockResolvedValue(undefined);

vi.mock("livekit-client", () => {
  class MockRoom {
    state = ConnectionState.Connected;
    localParticipant = {
      sid: "local-sid",
      identity: "user-1",
      name: "Хост Иван",
      metadata: JSON.stringify({ role: "HOST" }),
      isSpeaking: false,
      isMicrophoneEnabled: false,
      isCameraEnabled: false,
      isScreenShareEnabled: false,
      videoTrackPublications: new Map(),
      audioTrackPublications: new Map(),
      getTrackPublication: vi.fn().mockReturnValue(null),
      setMicrophoneEnabled: mockSetMicrophoneEnabled,
      setCameraEnabled: mockSetCameraEnabled,
      setScreenShareEnabled: mockSetScreenShareEnabled,
    };
    remoteParticipants = new Map([
      [
        "remote-1",
        {
          sid: "remote-1",
          identity: "guest_uuid",
          name: "Гость Петр",
          metadata: JSON.stringify({ role: "PARTICIPANT" }),
          isSpeaking: false,
          isMicrophoneEnabled: true,
          isCameraEnabled: false,
          isScreenShareEnabled: false,
          getTrackPublication: vi.fn().mockReturnValue(null),
        },
      ],
    ]);
    on = vi.fn();
    off = vi.fn();
    connect = mockConnect;
    disconnect = mockDisconnect;
    switchActiveDevice = mockSwitchActiveDevice;
  }

  return {
    Room: MockRoom,
    Track: {
      Source: {
        Camera: "camera",
        Microphone: "microphone",
        ScreenShare: "screen_share",
        ScreenShareAudio: "screen_share_audio",
      },
    },
    RoomEvent: {
      ConnectionStateChanged: "connectionStateChanged",
      ParticipantConnected: "participantConnected",
      ParticipantDisconnected: "participantDisconnected",
      TrackSubscribed: "trackSubscribed",
      TrackUnsubscribed: "trackUnsubscribed",
      LocalTrackPublished: "localTrackPublished",
      LocalTrackUnpublished: "localTrackUnpublished",
      TrackMuted: "trackMuted",
      TrackUnmuted: "trackUnmuted",
      ActiveSpeakersChanged: "activeSpeakersChanged",
      Disconnected: "disconnected",
    },
    ConnectionState: {
      Connected: "connected",
      Connecting: "connecting",
      Disconnected: "disconnected",
      Reconnecting: "reconnecting",
    },
    VideoPresets: {
      h720: { resolution: { width: 1280, height: 720 } },
    },
  };
});

describe("useMeetingRoom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with disconnected state", () => {
    const { result } = renderHook(() =>
      useMeetingRoom({
        token: null,
        serverUrl: null,
      }),
    );

    expect(result.current.connectionState).toBe(ConnectionState.Disconnected);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.participants).toEqual([]);
    expect(result.current.localParticipant).toBeNull();
  });

  it("should connect and populate participants", async () => {
    const { result } = renderHook(() =>
      useMeetingRoom({
        token: "mock-token",
        serverUrl: "wss://livekit.example.com",
        role: "HOST",
      }),
    );

    let success = false;
    await act(async () => {
      success = await result.current.connect();
    });

    expect(success).toBe(true);
    expect(mockConnect).toHaveBeenCalledWith(
      "wss://livekit.example.com",
      "mock-token",
      { autoSubscribe: true },
    );
    expect(result.current.participants).toHaveLength(2);
    expect(result.current.localParticipant?.identity).toBe("user-1");
    expect(result.current.localParticipant?.role).toBe("HOST");
  });

  it("should toggle microphone and camera", async () => {
    const { result } = renderHook(() =>
      useMeetingRoom({
        token: "mock-token",
        serverUrl: "wss://livekit.example.com",
      }),
    );

    await act(async () => {
      await result.current.connect();
    });

    await act(async () => {
      await result.current.toggleMicrophone();
    });
    expect(mockSetMicrophoneEnabled).toHaveBeenCalledWith(true);

    await act(async () => {
      await result.current.toggleCamera();
    });
    expect(mockSetCameraEnabled).toHaveBeenCalledWith(true);
  });

  it("should toggle screen share", async () => {
    const { result } = renderHook(() =>
      useMeetingRoom({
        token: "mock-token",
        serverUrl: "wss://livekit.example.com",
      }),
    );

    await act(async () => {
      await result.current.connect();
    });

    await act(async () => {
      await result.current.startScreenShare();
    });
    expect(mockSetScreenShareEnabled).toHaveBeenCalledWith(true, {
      audio: true,
    });

    await act(async () => {
      await result.current.stopScreenShare();
    });
    expect(mockSetScreenShareEnabled).toHaveBeenCalledWith(false);
  });

  it("should switch audio and video devices", async () => {
    const { result } = renderHook(() =>
      useMeetingRoom({
        token: "mock-token",
        serverUrl: "wss://livekit.example.com",
      }),
    );

    await act(async () => {
      await result.current.connect();
    });

    await act(async () => {
      await result.current.switchAudioInput("mic-device-id");
      await result.current.switchVideoInput("cam-device-id");
      await result.current.switchAudioOutput("speaker-device-id");
    });

    expect(mockSwitchActiveDevice).toHaveBeenCalledWith(
      "audioinput",
      "mic-device-id",
    );
    expect(mockSwitchActiveDevice).toHaveBeenCalledWith(
      "videoinput",
      "cam-device-id",
    );
    expect(mockSwitchActiveDevice).toHaveBeenCalledWith(
      "audiooutput",
      "speaker-device-id",
    );
  });

  it("should disconnect and clean up on disconnect call", async () => {
    const { result } = renderHook(() =>
      useMeetingRoom({
        token: "mock-token",
        serverUrl: "wss://livekit.example.com",
      }),
    );

    await act(async () => {
      await result.current.connect();
      await result.current.disconnect();
    });

    expect(mockDisconnect).toHaveBeenCalled();
    expect(result.current.connectionState).toBe(ConnectionState.Disconnected);
    expect(result.current.participants).toEqual([]);
  });
});
