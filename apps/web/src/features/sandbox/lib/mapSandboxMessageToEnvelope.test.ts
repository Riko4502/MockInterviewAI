import { describe, expect, it } from "vitest";
import type { SandboxRealtimeMessage } from "../model/types";
import { mapSandboxMessageToEnvelope } from "./mapSandboxMessageToEnvelope";

describe("mapSandboxMessageToEnvelope", () => {
  const roomId = "test-room-123";

  it("should correctly map 'code-update' message to 'code.update' WebSocket envelope", () => {
    const msg: SandboxRealtimeMessage = {
      id: "message-123",
      type: "code-update",
      roomId,
      senderId: "user-1",
      senderName: "Alice",
      payload: {
        code: "const x = 42;",
        language: "typescript",
      },
    };

    const envelope = mapSandboxMessageToEnvelope(msg, roomId);

    expect(envelope.type).toBe("code.update");
    expect(envelope.sessionId).toBe(roomId);
    expect(envelope.requestId).toBe("message-123");
    expect(envelope.payload).toMatchObject({
      filePath: "main",
      language: "typescript",
      content: "const x = 42;",
    });
  });

  it("should correctly map 'cursor-move' message to 'cursor.move' WebSocket envelope", () => {
    const msg: SandboxRealtimeMessage = {
      type: "cursor-move",
      roomId,
      senderId: "user-2",
      senderName: "Bob",
      payload: {
        cursor: {
          line: 10,
          column: 5,
          selectionEndLine: 10,
          selectionEndColumn: 12,
        },
      },
    };

    const envelope = mapSandboxMessageToEnvelope(msg, roomId);

    expect(envelope.type).toBe("cursor.move");
    expect(envelope.sessionId).toBe(roomId);
    expect(envelope.payload).toMatchObject({
      userId: "user-2",
      username: "Bob",
      line: 10,
      column: 5,
      selectionStart: 10,
      selectionEnd: 12,
    });
  });

  it("should correctly map 'presence-leave' message to 'presence.leave' WebSocket envelope", () => {
    const msg: SandboxRealtimeMessage = {
      type: "presence-leave",
      roomId,
      senderId: "user-3",
      senderName: "Charlie",
      payload: {},
    };

    const envelope = mapSandboxMessageToEnvelope(msg, roomId);

    expect(envelope.type).toBe("presence.leave");
    expect(envelope.sessionId).toBe(roomId);
    expect(envelope.payload).toMatchObject({
      userId: "user-3",
      username: "Charlie",
      role: "candidate",
    });
  });

  it("should correctly map 'task-change' message to 'chat.message' WebSocket envelope with JSON payload", () => {
    const msg: SandboxRealtimeMessage = {
      type: "task-change",
      roomId,
      senderId: "user-1",
      senderName: "Alice",
      payload: {
        taskId: "task-456",
      },
    };

    const envelope = mapSandboxMessageToEnvelope(msg, roomId);

    expect(envelope.type).toBe("chat.message");
    expect(envelope.sessionId).toBe(roomId);
    expect(envelope.payload).toHaveProperty("text");
    expect(JSON.parse((envelope.payload as { text: string }).text)).toEqual(
      msg,
    );
  });

  it("should correctly map 'webrtc-signal' message to 'chat.message' WebSocket envelope with JSON payload", () => {
    const msg: SandboxRealtimeMessage = {
      type: "webrtc-signal",
      roomId,
      senderId: "user-1",
      senderName: "Alice",
      payload: {
        signal: {
          type: "call-started",
          senderId: "user-1",
        },
      },
    };

    const envelope = mapSandboxMessageToEnvelope(msg, roomId);

    expect(envelope.type).toBe("chat.message");
    expect(envelope.sessionId).toBe(roomId);
    expect(envelope.payload).toHaveProperty("text");
    expect(JSON.parse((envelope.payload as { text: string }).text)).toEqual(
      msg,
    );
  });

  it("should correctly map 'run-result' message to 'chat.message' WebSocket envelope with JSON payload", () => {
    const msg: SandboxRealtimeMessage = {
      type: "run-result",
      roomId,
      senderId: "user-1",
      senderName: "Alice",
      payload: {
        runResult: {
          success: true,
          totalTests: 1,
          passedTests: 1,
          results: [],
          logs: ["Hello, World!"],
          totalTimeMs: 42,
        },
      },
    };

    const envelope = mapSandboxMessageToEnvelope(msg, roomId);

    expect(envelope.type).toBe("chat.message");
    expect(envelope.sessionId).toBe(roomId);
    expect(envelope.payload).toHaveProperty("text");
    expect(JSON.parse((envelope.payload as { text: string }).text)).toEqual(
      msg,
    );
  });

  it("should throw an error for unsupported message types", () => {
    const unsupportedMsg = {
      type: "unsupported-event",
      roomId,
      senderId: "user-1",
      senderName: "Alice",
      payload: {},
    } as unknown as SandboxRealtimeMessage;

    expect(() =>
      mapSandboxMessageToEnvelope(unsupportedMsg, roomId),
    ).toThrowError(/Unsupported message type/);
  });
});
