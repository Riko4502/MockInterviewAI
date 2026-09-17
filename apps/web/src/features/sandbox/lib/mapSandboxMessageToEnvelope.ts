import type { AnyWebSocketEnvelope } from "@packages/dto";
import { v4 as uuidv4 } from "uuid";
import type { SandboxRealtimeMessage } from "../model/types";

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

    case "task-change":
    case "webrtc-signal":
    case "run-result":
      return {
        ...base,
        type: "chat.message",
        payload: {
          messageId: msg.id ? `msg_${msg.id}` : `msg_${uuidv4()}`,
          senderId: msg.senderId,
          senderName: msg.senderName,
          text: JSON.stringify(msg),
          sentAt: base.timestamp,
        },
      };

    default:
      throw new Error(
        `Unsupported message type for WebSocket envelope: ${(msg as { type: string }).type}`,
      );
  }
}
