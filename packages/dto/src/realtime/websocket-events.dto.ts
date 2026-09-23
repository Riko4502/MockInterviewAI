import { z } from "zod";

/**
 * Максимальная длина Base64-строки для 64 КБ бинарных данных:
 * Math.ceil(65536 / 3) * 4 = 87384 символов.
 */
export const YJS_MAX_BASE64_LENGTH = 87384;

/**
 * Регулярное выражение для валидации Base64 строки.
 */
export const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Zod-схема бинарных данных Yjs (Base64 с лимитом 64 КБ).
 */
export const yjsDataSchema = z
  .string()
  .min(1, "Данные Yjs не могут быть пустыми")
  .max(YJS_MAX_BASE64_LENGTH, "Превышен максимальный размер дельты (64 КБ)")
  .regex(BASE64_REGEX, "Некорректный формат Base64");

/**
 * Zod-схема ключа задачи taskKey (например, '<taskId>:<lang>').
 */
export const yjsTaskKeySchema = z
  .string()
  .min(1, "taskKey обязателен и не может быть пустым");

export const yjsUpdatePayloadSchema = z.object({
  taskKey: yjsTaskKeySchema,
  updateId: z.string().min(1, "updateId обязателен"),
  data: yjsDataSchema,
});
export type YjsUpdatePayload = z.infer<typeof yjsUpdatePayloadSchema>;

export const yjsAckPayloadSchema = z.object({
  taskKey: yjsTaskKeySchema,
  updateId: z.string().min(1, "updateId обязателен"),
});
export type YjsAckPayload = z.infer<typeof yjsAckPayloadSchema>;

export const yjsInitPayloadSchema = z.object({
  taskKey: yjsTaskKeySchema,
  updates: z.array(yjsDataSchema),
});
export type YjsInitPayload = z.infer<typeof yjsInitPayloadSchema>;

export const yjsAwarenessPayloadSchema = z.object({
  taskKey: yjsTaskKeySchema,
  data: yjsDataSchema,
});
export type YjsAwarenessPayload = z.infer<typeof yjsAwarenessPayloadSchema>;

export const taskSwitchPayloadSchema = z.object({
  taskKey: yjsTaskKeySchema,
});
export type TaskSwitchPayload = z.infer<typeof taskSwitchPayloadSchema>;

export const taskSwitchedPayloadSchema = z.object({
  taskKey: yjsTaskKeySchema,
});
export type TaskSwitchedPayload = z.infer<typeof taskSwitchedPayloadSchema>;

export type ParticipantRole = "candidate" | "interviewer" | "observer" | "ai";

export interface ParticipantInfo {
  userId: string;
  username: string;
  role: ParticipantRole | string;
  color?: string;
}

export interface RoomSyncPayload {
  sessionId: string;
  participants: ParticipantInfo[];
  codeState?: CodeUpdatePayload | null;
}

export interface PresenceJoinPayload {
  userId: string;
  username: string;
  role: ParticipantRole | string;
  color?: string;
  userCount?: number;
}

export interface PresenceLeavePayload {
  userId: string;
  username: string;
  role: ParticipantRole | string;
  userCount?: number;
}

export type SupportedLanguage =
  | "typescript"
  | "javascript"
  | "go"
  | "python"
  | "cpp"
  | "java";

/**
 * @deprecated Устарело. Заменено на протокол Yjs CRDT ('yjs.update', 'yjs.init').
 */
export interface CodeUpdatePayload {
  filePath: string;
  language: SupportedLanguage | string;
  content: string;
  delta?: string;
  version: number;
}

/**
 * @deprecated Устарело. Заменено на протокол присутствия Yjs ('yjs.awareness').
 */
export interface CursorPayload {
  userId: string;
  username: string;
  line: number;
  column: number;
  selectionStart?: number;
  selectionEnd?: number;
}

export interface ChatMessagePayload {
  messageId: string;
  senderId: string;
  senderName: string;
  text: string;
  sentAt: string;
}

export interface AISuggestionPayload {
  suggestionId: string;
  prompt?: string;
  hint: string;
  remainingHints?: number;
}

export interface MediaStatePayload {
  userId: string;
  isMuted?: boolean;
  isVideoOn?: boolean;
  isScreenShare?: boolean;
}

export interface MediaSpeakerPayload {
  userId: string;
  isSpeaking: boolean;
  audioLevel?: number;
}

export interface MediaRecordingPayload {
  sessionId: string;
  status: "started" | "stopped" | "failed";
  recordUrl?: string;
}

export interface SystemErrorPayload {
  code: string;
  message: string;
  details?: string;
}

export interface SystemAckPayload {
  targetRequestId: string;
  status: string;
}

export interface BaseWebSocketEnvelope<TType extends string, TPayload> {
  type: TType;
  version: number;
  sessionId: string;
  requestId: string;
  timestamp: string;
  payload: TPayload;
}

export const baseWebSocketEnvelopeSchema = <
  TType extends z.ZodLiteral<string>,
  TPayload extends z.ZodTypeAny,
>(
  typeSchema: TType,
  payloadSchema: TPayload,
) =>
  z.object({
    type: typeSchema,
    version: z.number().int().default(1),
    sessionId: z.string().min(1, "sessionId обязателен"),
    requestId: z.string().min(1, "requestId обязателен"),
    timestamp: z.string().min(1, "timestamp обязателен"),
    payload: payloadSchema,
  });

export const yjsUpdateEnvelopeSchema = baseWebSocketEnvelopeSchema(
  z.literal("yjs.update"),
  yjsUpdatePayloadSchema,
);
export type YjsUpdateEnvelope = z.infer<typeof yjsUpdateEnvelopeSchema>;

export const yjsAckEnvelopeSchema = baseWebSocketEnvelopeSchema(
  z.literal("yjs.ack"),
  yjsAckPayloadSchema,
);
export type YjsAckEnvelope = z.infer<typeof yjsAckEnvelopeSchema>;

export const yjsInitEnvelopeSchema = baseWebSocketEnvelopeSchema(
  z.literal("yjs.init"),
  yjsInitPayloadSchema,
);
export type YjsInitEnvelope = z.infer<typeof yjsInitEnvelopeSchema>;

export const yjsAwarenessEnvelopeSchema = baseWebSocketEnvelopeSchema(
  z.literal("yjs.awareness"),
  yjsAwarenessPayloadSchema,
);
export type YjsAwarenessEnvelope = z.infer<typeof yjsAwarenessEnvelopeSchema>;

export const taskSwitchEnvelopeSchema = baseWebSocketEnvelopeSchema(
  z.literal("task.switch"),
  taskSwitchPayloadSchema,
);
export type TaskSwitchEnvelope = z.infer<typeof taskSwitchEnvelopeSchema>;

export const taskSwitchedEnvelopeSchema = baseWebSocketEnvelopeSchema(
  z.literal("task.switched"),
  taskSwitchedPayloadSchema,
);
export type TaskSwitchedEnvelope = z.infer<typeof taskSwitchedEnvelopeSchema>;

export const roomErrorPayloadSchema = z.object({
  code: z.string().min(1, "code обязателен"),
  message: z.string().min(1, "message обязателен"),
  taskKey: z.string().optional(),
});
export type RoomErrorPayload = z.infer<typeof roomErrorPayloadSchema>;

export const roomErrorEnvelopeSchema = baseWebSocketEnvelopeSchema(
  z.literal("room.error"),
  roomErrorPayloadSchema,
);
export type RoomErrorEnvelope = z.infer<typeof roomErrorEnvelopeSchema>;

/**
 * Дискриминированное объединение всех входящих и исходящих WebSocket-событий.
 */
export type AnyWebSocketEnvelope =
  | BaseWebSocketEnvelope<"room.sync", RoomSyncPayload>
  | BaseWebSocketEnvelope<"room.error", RoomErrorPayload>
  | BaseWebSocketEnvelope<"presence.join", PresenceJoinPayload>
  | BaseWebSocketEnvelope<"presence.leave", PresenceLeavePayload>
  | BaseWebSocketEnvelope<"yjs.update", YjsUpdatePayload>
  | BaseWebSocketEnvelope<"yjs.ack", YjsAckPayload>
  | BaseWebSocketEnvelope<"yjs.init", YjsInitPayload>
  | BaseWebSocketEnvelope<"yjs.awareness", YjsAwarenessPayload>
  | BaseWebSocketEnvelope<"task.switch", TaskSwitchPayload>
  | BaseWebSocketEnvelope<"task.switched", TaskSwitchedPayload>
  | BaseWebSocketEnvelope<"code.update", CodeUpdatePayload>
  | BaseWebSocketEnvelope<"cursor.move", CursorPayload>
  | BaseWebSocketEnvelope<"chat.message", ChatMessagePayload>
  | BaseWebSocketEnvelope<"ai.suggestion", AISuggestionPayload>
  | BaseWebSocketEnvelope<"media.state_update", MediaStatePayload>
  | BaseWebSocketEnvelope<"media.speaker", MediaSpeakerPayload>
  | BaseWebSocketEnvelope<"media.recording", MediaRecordingPayload>
  | BaseWebSocketEnvelope<"system.error", SystemErrorPayload>
  | BaseWebSocketEnvelope<"system.ack", SystemAckPayload>
  | BaseWebSocketEnvelope<"system.ping", Record<string, unknown>>
  | BaseWebSocketEnvelope<"system.pong", Record<string, unknown>>;
