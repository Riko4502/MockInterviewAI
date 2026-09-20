import type { AnyWebSocketEnvelope } from "@packages/dto";
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

  it("should track pending code update by requestId and clear it upon server code.update echo", async () => {
    const onRemoteCodeUpdate = vi.fn();

    let hookResult!: { current: ReturnType<typeof useSandboxRealtime> };
    let unmountHook!: () => void;

    await act(async () => {
      const { result, unmount } = renderHook(() =>
        useSandboxRealtime({
          roomId: "test-room-pending-code",
          onRemoteCodeUpdate,
        }),
      );
      hookResult = result;
      unmountHook = unmount;
    });

    const handler = wsMessageHandler as (event: { data: string }) => void;

    // 1. Broadcast local code update
    mockWsSend.mockClear();
    act(() => {
      hookResult.current.broadcastCodeUpdate("const a = 10;", "typescript");
    });

    expect(mockWsSend).toHaveBeenCalledTimes(1);
    const sentEnvelope = JSON.parse(
      mockWsSend.mock.calls[0][0],
    ) as AnyWebSocketEnvelope;
    const sentRequestId = sentEnvelope.requestId;
    expect(sentRequestId).toBeDefined();

    // 2. Server echoes back the code.update with matching requestId
    const echoEnvelope = {
      sessionId: "test-room-pending-code",
      requestId: sentRequestId,
      timestamp: new Date().toISOString(),
      version: 1,
      type: "code.update",
      payload: {
        filePath: "main",
        language: "typescript",
        content: "const a = 10;",
        version: 1,
      },
    };

    act(() => {
      handler({ data: JSON.stringify(echoEnvelope) });
    });

    // onRemoteCodeUpdate should not be called for own echo
    expect(onRemoteCodeUpdate).not.toHaveBeenCalled();

    // 3. Simulate room.sync (e.g. after reconnect); pending code was acknowledged, so it should NOT resend old code
    mockWsSend.mockClear();
    const syncEnvelope = {
      sessionId: "test-room-pending-code",
      requestId: "sync_req_1",
      timestamp: new Date().toISOString(),
      version: 1,
      type: "room.sync",
      payload: {
        sessionId: "test-room-pending-code",
        participants: [],
        codeState: {
          filePath: "main",
          language: "typescript",
          content: "const a = 10;",
          version: 1,
        },
      },
    };

    act(() => {
      handler({ data: JSON.stringify(syncEnvelope) });
    });

    expect(mockWsSend).not.toHaveBeenCalled();
    expect(onRemoteCodeUpdate).toHaveBeenCalledWith(
      "const a = 10;",
      "typescript",
    );

    unmountHook();
  });

  it("should not clear pending code when receiving a duplicate message from another user", async () => {
    const onRemoteCodeUpdate = vi.fn();

    let hookResult!: { current: ReturnType<typeof useSandboxRealtime> };
    let unmountHook!: () => void;

    await act(async () => {
      const { result, unmount } = renderHook(() =>
        useSandboxRealtime({
          roomId: "test-room-pending-code-remote-dup",
          onRemoteCodeUpdate,
        }),
      );
      hookResult = result;
      unmountHook = unmount;
    });

    const handler = wsMessageHandler as (event: { data: string }) => void;

    // 0. Initial room.sync establishes baseVersion: 1
    act(() => {
      handler({
        data: JSON.stringify({
          sessionId: "test-room-pending-code-remote-dup",
          requestId: "sync_req_init",
          timestamp: new Date().toISOString(),
          version: 1,
          type: "room.sync",
          payload: {
            sessionId: "test-room-pending-code-remote-dup",
            participants: [],
            codeState: {
              filePath: "main",
              language: "typescript",
              content: "const initial = true;",
              version: 1,
            },
          },
        }),
      });
    });

    // 1. Broadcast local code update (unacknowledged, baseVersion: 1)
    mockWsSend.mockClear();
    act(() => {
      hookResult.current.broadcastCodeUpdate(
        "const pending = true;",
        "typescript",
      );
    });

    expect(mockWsSend).toHaveBeenCalledTimes(1);
    const sentEnvelope = JSON.parse(
      mockWsSend.mock.calls[0][0],
    ) as AnyWebSocketEnvelope;
    const myRequestId = sentEnvelope.requestId;

    // 2. Receive a remote code.update from another user twice (duplicate)
    const remoteEnvelope = {
      sessionId: "test-room-pending-code-remote-dup",
      requestId: "remote-user-req-999",
      timestamp: new Date().toISOString(),
      version: 1,
      type: "code.update",
      payload: {
        filePath: "main",
        language: "typescript",
        content: "const remote = true;",
        version: 1,
      },
    };

    // First arrival
    act(() => {
      handler({ data: JSON.stringify(remoteEnvelope) });
    });
    expect(onRemoteCodeUpdate).toHaveBeenCalledWith(
      "const remote = true;",
      "typescript",
    );

    // Second arrival (duplicate)
    act(() => {
      handler({ data: JSON.stringify(remoteEnvelope) });
    });
    // Should still be called only once
    expect(onRemoteCodeUpdate).toHaveBeenCalledTimes(2);

    // 3. Now simulate room.sync (reconnect); our pending code should STILL be pending and resent (baseVersion === serverVersion: 1)
    mockWsSend.mockClear();
    const syncEnvelope = {
      sessionId: "test-room-pending-code-remote-dup",
      requestId: "sync_req_2",
      timestamp: new Date().toISOString(),
      version: 1,
      type: "room.sync",
      payload: {
        sessionId: "test-room-pending-code-remote-dup",
        participants: [],
        codeState: {
          filePath: "main",
          language: "typescript",
          content: "const remote = true;",
          version: 1,
        },
      },
    };

    act(() => {
      handler({ data: JSON.stringify(syncEnvelope) });
    });

    // Pending code should be resent on room.sync because baseVersion matches serverVersion
    expect(mockWsSend).toHaveBeenCalledTimes(1);
    const resentEnvelope = JSON.parse(
      mockWsSend.mock.calls[0][0],
    ) as AnyWebSocketEnvelope;
    expect(resentEnvelope.requestId).toBe(myRequestId);
    expect((resentEnvelope.payload as { content: string }).content).toBe(
      "const pending = true;",
    );

    unmountHook();
  });

  it("should resend pending code on room.sync when baseVersion matches serverVersion (local-newer state)", async () => {
    const onRemoteCodeUpdate = vi.fn();

    let hookResult!: { current: ReturnType<typeof useSandboxRealtime> };
    let unmountHook!: () => void;

    await act(async () => {
      const { result, unmount } = renderHook(() =>
        useSandboxRealtime({
          roomId: "test-room-local-newer",
          onRemoteCodeUpdate,
        }),
      );
      hookResult = result;
      unmountHook = unmount;
    });

    const handler = wsMessageHandler as (event: { data: string }) => void;

    // 1. Initial room.sync sets server version to 5
    act(() => {
      handler({
        data: JSON.stringify({
          sessionId: "test-room-local-newer",
          requestId: "init_sync",
          timestamp: new Date().toISOString(),
          version: 5,
          type: "room.sync",
          payload: {
            sessionId: "test-room-local-newer",
            participants: [],
            codeState: {
              filePath: "main",
              language: "typescript",
              content: "const a = 5;",
              version: 5,
            },
          },
        }),
      });
    });

    // 2. User edits code locally (baseVersion recorded as 5)
    mockWsSend.mockClear();
    act(() => {
      hookResult.current.broadcastCodeUpdate("const a = 6;", "typescript");
    });

    expect(mockWsSend).toHaveBeenCalledTimes(1);
    const sentReqId = (
      JSON.parse(mockWsSend.mock.calls[0][0]) as AnyWebSocketEnvelope
    ).requestId;

    // 3. Reconnect occurs: server sends room.sync with version 5 (no one else changed code)
    mockWsSend.mockClear();
    act(() => {
      handler({
        data: JSON.stringify({
          sessionId: "test-room-local-newer",
          requestId: "reconnect_sync",
          timestamp: new Date().toISOString(),
          version: 5,
          type: "room.sync",
          payload: {
            sessionId: "test-room-local-newer",
            participants: [],
            codeState: {
              filePath: "main",
              language: "typescript",
              content: "const a = 5;",
              version: 5,
            },
          },
        }),
      });
    });

    // 4. Because baseVersion (5) === serverVersion (5), pending code is safely resent
    expect(mockWsSend).toHaveBeenCalledTimes(1);
    const resent = JSON.parse(
      mockWsSend.mock.calls[0][0],
    ) as AnyWebSocketEnvelope;
    expect(resent.requestId).toBe(sentReqId);
    expect((resent.payload as { content: string }).content).toBe(
      "const a = 6;",
    );

    unmountHook();
  });

  it("should discard pending code on room.sync when serverVersion is newer than baseVersion (server-newer state)", async () => {
    const onRemoteCodeUpdate = vi.fn();

    let hookResult!: { current: ReturnType<typeof useSandboxRealtime> };
    let unmountHook!: () => void;

    await act(async () => {
      const { result, unmount } = renderHook(() =>
        useSandboxRealtime({
          roomId: "test-room-server-newer",
          onRemoteCodeUpdate,
        }),
      );
      hookResult = result;
      unmountHook = unmount;
    });

    const handler = wsMessageHandler as (event: { data: string }) => void;

    // 1. Initial room.sync sets server version to 5
    act(() => {
      handler({
        data: JSON.stringify({
          sessionId: "test-room-server-newer",
          requestId: "init_sync",
          timestamp: new Date().toISOString(),
          version: 5,
          type: "room.sync",
          payload: {
            sessionId: "test-room-server-newer",
            participants: [],
            codeState: {
              filePath: "main",
              language: "typescript",
              content: "const a = 5;",
              version: 5,
            },
          },
        }),
      });
    });

    // 2. User edits code locally based on version 5
    mockWsSend.mockClear();
    act(() => {
      hookResult.current.broadcastCodeUpdate("const a = 6;", "typescript");
    });

    expect(mockWsSend).toHaveBeenCalledTimes(1);

    // 3. While disconnected / pending, another participant updated the code on server to version 6
    mockWsSend.mockClear();
    onRemoteCodeUpdate.mockClear();

    act(() => {
      handler({
        data: JSON.stringify({
          sessionId: "test-room-server-newer",
          requestId: "reconnect_sync_newer",
          timestamp: new Date().toISOString(),
          version: 6,
          type: "room.sync",
          payload: {
            sessionId: "test-room-server-newer",
            participants: [],
            codeState: {
              filePath: "main",
              language: "typescript",
              content: "const remoteEdit = 999;",
              version: 6,
            },
          },
        }),
      });
    });

    // 4. Server-newer state (serverVersion: 6 > baseVersion: 5):
    // Outdated pending code MUST NOT be resent to avoid overwriting peer's changes with higher version
    expect(mockWsSend).not.toHaveBeenCalled();

    // The remote code update must be applied locally
    expect(onRemoteCodeUpdate).toHaveBeenCalledWith(
      "const remoteEdit = 999;",
      "typescript",
    );

    unmountHook();
  });

  it("should clear pending task change upon matching server chat.message echo and system.ack", async () => {
    const onRemoteTaskChange = vi.fn();

    let hookResult!: { current: ReturnType<typeof useSandboxRealtime> };
    let unmountHook!: () => void;

    await act(async () => {
      const { result, unmount } = renderHook(() =>
        useSandboxRealtime({
          roomId: "test-room-pending-task",
          onRemoteTaskChange,
        }),
      );
      hookResult = result;
      unmountHook = unmount;
    });

    const handler = wsMessageHandler as (event: { data: string }) => void;

    // 1. Broadcast task change
    mockWsSend.mockClear();
    act(() => {
      hookResult.current.broadcastTaskChange("task-binary-search");
    });

    expect(mockWsSend).toHaveBeenCalledTimes(1);
    const sentEnvelope = JSON.parse(
      mockWsSend.mock.calls[0][0],
    ) as AnyWebSocketEnvelope;
    const sentTaskId = sentEnvelope.requestId;

    // 2. Server responds with system.ack for this requestId
    const ackEnvelope = {
      sessionId: "test-room-pending-task",
      requestId: "server_ack_1",
      timestamp: new Date().toISOString(),
      version: 1,
      type: "system.ack",
      payload: {
        targetRequestId: sentTaskId,
        status: "ok",
      },
    };

    act(() => {
      handler({ data: JSON.stringify(ackEnvelope) });
    });

    // 3. Receive another remote task change from peer
    const remoteTaskMessage = {
      id: "remote_task_msg_1",
      type: "task-change" as const,
      roomId: "test-room-pending-task",
      senderId: "remote-peer-42",
      senderName: "Interviewer",
      payload: { taskId: "task-quick-sort" },
    };

    const remoteChatEnvelope = {
      sessionId: "test-room-pending-task",
      requestId: "remote_task_req_1",
      timestamp: new Date().toISOString(),
      version: 1,
      type: "chat.message",
      payload: {
        messageId: "msg_remote_task_msg_1",
        senderId: "remote-peer-42",
        senderName: "Interviewer",
        text: JSON.stringify(remoteTaskMessage),
        sentAt: new Date().toISOString(),
      },
    };

    act(() => {
      handler({ data: JSON.stringify(remoteChatEnvelope) });
    });

    expect(onRemoteTaskChange).toHaveBeenCalledWith("task-quick-sort");

    unmountHook();
  });
});
