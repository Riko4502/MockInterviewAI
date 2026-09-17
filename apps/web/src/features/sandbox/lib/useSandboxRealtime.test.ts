import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebRTCSignal } from "../model/types";
import { useSandboxRealtime } from "./useSandboxRealtime";

// Mock BroadcastChannel
class MockBroadcastChannel {
  name: string;
  static instances: MockBroadcastChannel[] = [];
  listeners: ((event: MessageEvent) => void)[] = [];

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === "message") {
      this.listeners.push(listener);
    }
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === "message") {
      this.listeners = this.listeners.filter((l) => l !== listener);
    }
  }

  postMessage(data: unknown) {
    for (const ch of MockBroadcastChannel.instances) {
      if (ch !== this && ch.name === this.name) {
        for (const listener of ch.listeners) {
          listener({ data } as MessageEvent);
        }
      }
    }
  }

  close() {
    MockBroadcastChannel.instances = MockBroadcastChannel.instances.filter(
      (inst) => inst !== this,
    );
    this.listeners = [];
  }
}

// Mock ticket & connectWebSocket
let wsMessageHandler: ((event: { data: string }) => void) | null = null;
const mockWsSend = vi.fn();
const mockWsClose = vi.fn();

vi.mock("@/features/realtime/lib/ticket", () => ({
  connectWebSocket: vi.fn().mockImplementation((_roomId, options) => {
    wsMessageHandler = options.onMessage;
    return Promise.resolve({
      socket: {
        readyState: 1, // OPEN
        send: mockWsSend,
      },
      close: mockWsClose,
    });
  }),
}));

describe("useSandboxRealtime deduplication", () => {
  const originalBC = globalThis.BroadcastChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    wsMessageHandler = null;
    MockBroadcastChannel.instances = [];
    // @ts-expect-error Mocking global BroadcastChannel
    globalThis.BroadcastChannel = MockBroadcastChannel;
  });

  afterEach(() => {
    globalThis.BroadcastChannel = originalBC;
  });

  it("should not deliver the same WebRTC signal twice when received via BroadcastChannel and WebSocket", async () => {
    const onRemoteWebRTCSignal = vi.fn();
    const webRTCListener = vi.fn();

    const { result, unmount } = renderHook(() =>
      useSandboxRealtime({
        roomId: "test-room-dedup",
        onRemoteWebRTCSignal,
      }),
    );

    const unsubscribe = result.current.subscribeWebRTCSignal(webRTCListener);

    const signal: WebRTCSignal = {
      type: "offer",
      sdp: { type: "offer", sdp: "v=0..." },
      senderId: "remote-user-1",
    };

    const duplicateMessageId = "unique-msg-id-12345";
    const realtimeMessage = {
      id: duplicateMessageId,
      type: "webrtc-signal" as const,
      roomId: "test-room-dedup",
      senderId: "remote-user-1",
      senderName: "Remote User",
      payload: { signal },
    };

    // 1. Simulate arrival via BroadcastChannel
    const bcInstance = MockBroadcastChannel.instances[0];
    expect(bcInstance).toBeDefined();

    act(() => {
      for (const listener of bcInstance.listeners) {
        listener({ data: realtimeMessage } as MessageEvent);
      }
    });

    expect(onRemoteWebRTCSignal).toHaveBeenCalledTimes(1);
    expect(webRTCListener).toHaveBeenCalledTimes(1);

    // 2. Simulate arrival of identical message via WebSocket envelope
    const wsEnvelope = {
      sessionId: "test-room-dedup",
      requestId: "req_1",
      timestamp: new Date().toISOString(),
      version: 1,
      type: "chat.message",
      payload: {
        messageId: `msg_${duplicateMessageId}`,
        senderId: "remote-user-1",
        senderName: "Remote User",
        text: JSON.stringify(realtimeMessage),
        sentAt: new Date().toISOString(),
      },
    };

    expect(typeof wsMessageHandler).toBe("function");
    const handler = wsMessageHandler as (event: { data: string }) => void;

    act(() => {
      handler({ data: JSON.stringify(wsEnvelope) });
    });

    // Should still be called only once (duplicate discarded)
    expect(onRemoteWebRTCSignal).toHaveBeenCalledTimes(1);
    expect(webRTCListener).toHaveBeenCalledTimes(1);

    unsubscribe();
    unmount();
  });

  it("should apply empty code snapshot on room.sync event", () => {
    const onRemoteCodeUpdate = vi.fn();

    const { unmount } = renderHook(() =>
      useSandboxRealtime({
        roomId: "test-room-empty-sync",
        onRemoteCodeUpdate,
      }),
    );

    expect(typeof wsMessageHandler).toBe("function");
    const handler = wsMessageHandler as (event: { data: string }) => void;

    const syncEnvelope = {
      sessionId: "test-room-empty-sync",
      requestId: "req_sync_1",
      timestamp: new Date().toISOString(),
      version: 1,
      type: "room.sync",
      payload: {
        sessionId: "test-room-empty-sync",
        participants: [],
        codeState: {
          filePath: "main.ts",
          language: "typescript",
          content: "",
          version: 1,
        },
      },
    };

    act(() => {
      handler({ data: JSON.stringify(syncEnvelope) });
    });

    expect(onRemoteCodeUpdate).toHaveBeenCalledTimes(1);
    expect(onRemoteCodeUpdate).toHaveBeenCalledWith("", "typescript");

    unmount();
  });

  it("should overwrite nested senderId and signal.senderId with server-verified envelope.payload.senderId", () => {
    const onRemoteWebRTCSignal = vi.fn();

    const { unmount } = renderHook(() =>
      useSandboxRealtime({
        roomId: "test-room-auth",
        onRemoteWebRTCSignal,
      }),
    );

    expect(typeof wsMessageHandler).toBe("function");
    const handler = wsMessageHandler as (event: { data: string }) => void;

    // Вложенный payload пытается подделать идентичность другого пользователя (spoofed-victim-id)
    const spoofedSignal: WebRTCSignal = {
      type: "offer",
      sdp: { type: "offer", sdp: "v=0..." },
      senderId: "spoofed-victim-id",
    };

    const spoofedMessage = {
      id: "msg-auth-1",
      type: "webrtc-signal" as const,
      roomId: "test-room-auth",
      senderId: "spoofed-victim-id",
      senderName: "Impersonator",
      payload: { signal: spoofedSignal },
    };

    // Сервер проверил соединение и выставил авторизованный envelope.payload.senderId
    const serverEnvelope = {
      sessionId: "test-room-auth",
      requestId: "req_auth_1",
      timestamp: new Date().toISOString(),
      version: 1,
      type: "chat.message",
      payload: {
        messageId: "msg-auth-1",
        senderId: "verified-server-user-id",
        senderName: "Legit User",
        text: JSON.stringify(spoofedMessage),
        sentAt: new Date().toISOString(),
      },
    };

    act(() => {
      handler({ data: JSON.stringify(serverEnvelope) });
    });

    expect(onRemoteWebRTCSignal).toHaveBeenCalledTimes(1);
    expect(onRemoteWebRTCSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "offer",
        senderId: "verified-server-user-id",
      }),
    );

    unmount();
  });

  it("should reject chat.message envelope without external senderId", () => {
    const onRemoteWebRTCSignal = vi.fn();

    const { unmount } = renderHook(() =>
      useSandboxRealtime({
        roomId: "test-room-auth-reject",
        onRemoteWebRTCSignal,
      }),
    );

    expect(typeof wsMessageHandler).toBe("function");
    const handler = wsMessageHandler as (event: { data: string }) => void;

    const signal: WebRTCSignal = {
      type: "call-started",
      senderId: "attacker-id",
    };

    const message = {
      id: "msg-auth-reject-1",
      type: "webrtc-signal" as const,
      roomId: "test-room-auth-reject",
      senderId: "attacker-id",
      senderName: "Attacker",
      payload: { signal },
    };

    const envelopeWithoutSenderId = {
      sessionId: "test-room-auth-reject",
      requestId: "req_reject_1",
      timestamp: new Date().toISOString(),
      version: 1,
      type: "chat.message",
      payload: {
        messageId: "msg-auth-reject-1",
        senderId: "",
        senderName: "",
        text: JSON.stringify(message),
        sentAt: new Date().toISOString(),
      },
    };

    act(() => {
      handler({ data: JSON.stringify(envelopeWithoutSenderId) });
    });

    expect(onRemoteWebRTCSignal).not.toHaveBeenCalled();

    unmount();
  });
});
