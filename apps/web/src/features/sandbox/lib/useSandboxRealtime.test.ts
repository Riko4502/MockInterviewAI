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

    act(() => {
      wsMessageHandler?.({ data: JSON.stringify(wsEnvelope) });
    });

    // Should still be called only once (duplicate discarded)
    expect(onRemoteWebRTCSignal).toHaveBeenCalledTimes(1);
    expect(webRTCListener).toHaveBeenCalledTimes(1);

    unsubscribe();
    unmount();
  });
});
