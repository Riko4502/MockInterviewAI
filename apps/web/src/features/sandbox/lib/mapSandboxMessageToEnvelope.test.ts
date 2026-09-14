import { describe, expect, it } from "vitest";
import { mapSandboxMessageToEnvelope } from "./mapSandboxMessageToEnvelope";
import type { SandboxRealtimeMessage } from "./useSandboxRealtime";

describe("mapSandboxMessageToEnvelope", () => {
  const roomId = "test-room-123";

  it("should correctly map 'code-update' message to 'code.update' WebSocket envelope", () => {
    const msg: SandboxRealtimeMessage = {
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
