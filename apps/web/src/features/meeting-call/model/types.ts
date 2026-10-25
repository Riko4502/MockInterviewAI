/** Типы событий, передаваемых по LiveKit WebRTC DataChannel */
export type DataChannelMessageType = "CHAT_MESSAGE" | "RAISE_HAND" | "REACTION";

/** Сообщение текстового чата встречи */
export interface ChatMessageData {
  type: "CHAT_MESSAGE";
  /** Уникальный ID сообщения (uuid) */
  id: string;
  /** Идентификатор отправителя (identity) */
  senderId: string;
  /** Отображаемое имя отправителя */
  senderName: string;
  /** Текст сообщения */
  text: string;
  /** ISO 8601 строка времени отправки */
  timestamp: string;
}

/** Сигнал поднятия или опускания руки участником */
export interface RaiseHandData {
  type: "RAISE_HAND";
  /** Идентификатор участника */
  participantId: string;
  /** true = рука поднята, false = рука опущена */
  raised: boolean;
}

/** Всплывающая эмодзи-реакция участника */
export interface ReactionData {
  type: "REACTION";
  /** Уникальный ID реакции */
  id: string;
  /** Идентификатор участника */
  participantId: string;
  /** Символ эмодзи (👍, ❤️, 👏, 🔥, 🎉) */
  emoji: string;
}

/** Объединенный тип всех сообщений DataChannel */
export type DataChannelPayload = ChatMessageData | RaiseHandData | ReactionData;

/** Элемент активной реакции для UI с меткой времени для автоудаления */
export interface MeetingReactionItem {
  id: string;
  participantId: string;
  emoji: string;
  createdAt: number;
}

/** Type guard для безопасной проверки полезной нагрузки DataChannel */
export function isDataChannelPayload(
  data: unknown,
): data is DataChannelPayload {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Record<string, unknown>;

  if (candidate.type === "CHAT_MESSAGE") {
    return (
      typeof candidate.id === "string" &&
      typeof candidate.senderId === "string" &&
      typeof candidate.senderName === "string" &&
      typeof candidate.text === "string" &&
      typeof candidate.timestamp === "string"
    );
  }

  if (candidate.type === "RAISE_HAND") {
    return (
      typeof candidate.participantId === "string" &&
      typeof candidate.raised === "boolean"
    );
  }

  if (candidate.type === "REACTION") {
    return (
      typeof candidate.id === "string" &&
      typeof candidate.participantId === "string" &&
      typeof candidate.emoji === "string"
    );
  }

  return false;
}
