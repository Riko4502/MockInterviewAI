import { act, renderHook } from "@testing-library/react";
import { ConnectionState } from "livekit-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveKitRoom } from "./useLiveKitRoom";

const mockDisconnect = vi.fn().mockResolvedValue(undefined);
const mockConnect = vi.fn().mockResolvedValue(undefined);

vi.mock("@packages/api", () => ({
  realtimeControllerGetMediaToken: vi.fn().mockResolvedValue({
    token: "mock-jwt-media-token",
    serverUrl: "wss://livekit.example.com",
  }),
}));

vi.mock("livekit-client", () => {
  class MockRoom {
    state = ConnectionState.Connected;
    localParticipant = {
      videoTrackPublications: new Map(),
      audioTrackPublications: new Map(),
      setMicrophoneEnabled: vi.fn(),
      setCameraEnabled: vi.fn(),
      setScreenShareEnabled: vi.fn(),
    };
    remoteParticipants = new Map();
    on = vi.fn();
    off = vi.fn();
    connect = mockConnect;
    disconnect = mockDisconnect;
  }

  return {
    Room: MockRoom,
    RoomEvent: {
      ConnectionStateChanged: "connectionStateChanged",
      TrackSubscribed: "trackSubscribed",
      TrackUnsubscribed: "trackUnsubscribed",
      LocalTrackPublished: "localTrackPublished",
      LocalTrackUnpublished: "localTrackUnpublished",
      TrackMuted: "trackMuted",
      TrackUnmuted: "trackUnmuted",
      TrackPublished: "trackPublished",
      TrackUnpublished: "trackUnpublished",
      ParticipantConnected: "participantConnected",
      ParticipantDisconnected: "participantDisconnected",
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

describe("useLiveKitRoom end -> start race condition", () => {
  const validUUID = "12345678-1234-4234-8234-123456789abc";

  beforeEach(() => {
    vi.clearAllMocks();
    mockDisconnect.mockResolvedValue(undefined);
    mockConnect.mockResolvedValue(undefined);
  });

  it("should await in-flight disconnect before starting a new connection", async () => {
    const { result, unmount } = renderHook(() =>
      useLiveKitRoom({ sessionId: validUUID }),
    );

    // 1. First connection
    let connected = false;
    await act(async () => {
      connected = await result.current.connect();
    });
    expect(connected).toBe(true);
    expect(mockConnect).toHaveBeenCalledTimes(1);

    // 2. Setup pending disconnect
    let resolveDisconnect!: () => void;
    mockDisconnect.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveDisconnect = resolve;
        }),
    );

    // Trigger disconnect without awaiting completion (simulating handleEndCall)
    act(() => {
      void result.current.disconnect();
    });

    // 3. Immediately trigger connect before disconnect finishes (simulating rapid end -> start)
    let secondConnectPromise!: Promise<boolean>;
    act(() => {
      secondConnectPromise = result.current.connect();
    });

    // At this moment, connect should be awaiting disconnect completion
    expect(mockConnect).toHaveBeenCalledTimes(1);

    // 4. Resolve the disconnect promise
    await act(async () => {
      resolveDisconnect();
      await secondConnectPromise;
    });

    // Connect should now have executed after disconnect finished
    expect(mockConnect).toHaveBeenCalledTimes(2);

    unmount();
  });
});
