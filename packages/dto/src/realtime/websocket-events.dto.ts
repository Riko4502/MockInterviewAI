/**
 * DTO-схемы и интерфейсы протокола WebSocket комнаты интервью/песочницы.
 * Согласовано с бэкендом apps/realtime (internal/ws/message.go).
 */

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

export interface CodeUpdatePayload {
  filePath: string;
  language: SupportedLanguage | string;
  content: string;
  delta?: string;
  version: number;
}

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
  requestId?: string;
  timestamp?: string;
  payload: TPayload;
}

/**
 * Дискриминированное объединение всех входящих и исходящих WebSocket-событий.
 */
export type AnyWebSocketEnvelope =
  | BaseWebSocketEnvelope<"room.sync", RoomSyncPayload>
  | BaseWebSocketEnvelope<"presence.join", PresenceJoinPayload>
  | BaseWebSocketEnvelope<"presence.leave", PresenceLeavePayload>
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
