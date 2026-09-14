import type { AnyWebSocketEnvelope } from "@packages/dto";
import type { SandboxRealtimeMessage } from "./useSandboxRealtime";

/**
 * Mapper: преобразует внутреннее сообщение песочницы в типизированный WebSocket конверт Go-сервиса.
 */
export function mapSandboxMessageToEnvelope(
  msg: SandboxRealtimeMessage,
  roomId: string,
): AnyWebSocketEnvelope {
  const base = {
    sessionId: roomId,
    requestId: `req_${Date.now()}`,
    timestamp: new Date().toISOString(),
    version: 1,
  };

  switch (msg.type) {
    case "code-update":
      return {
        ...base,
        type: "code.update",
        payload: {
          filePath: "main",
          language: msg.payload.language || "typescript",
          content: msg.payload.code ?? "",
          version: Date.now(),
        },
      };

    case "cursor-move":
      return {
        ...base,
        type: "cursor.move",
        payload: {
          userId: msg.senderId,
          username: msg.senderName,
          line: msg.payload.cursor?.line ?? 1,
          column: msg.payload.cursor?.column ?? 1,
          selectionStart: msg.payload.cursor?.selectionEndLine,
          selectionEnd: msg.payload.cursor?.selectionEndColumn,
        },
      };

    case "presence-leave":
      return {
        ...base,
        type: "presence.leave",
        payload: {
          userId: msg.senderId,
          username: msg.senderName,
          role: "candidate",
        },
      };

    default:
      throw new Error(
        `Unsupported message type for WebSocket envelope: ${(msg as { type: string }).type}`,
      );
  }
}
