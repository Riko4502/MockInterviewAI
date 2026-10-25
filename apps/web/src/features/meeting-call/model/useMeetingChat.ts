"use client";

import { type Room, RoomEvent } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ChatMessageData,
  type DataChannelPayload,
  isDataChannelPayload,
  type MeetingReactionItem,
  type RaiseHandData,
  type ReactionData,
} from "./types";

export interface UseMeetingChatOptions {
  /** Экземпляр комнаты LiveKit */
  room: Room | null;
  /** ID локального участника */
  localParticipantId?: string;
  /** Отображаемое имя локального участника */
  localParticipantName?: string;
}

export interface UseMeetingChatReturn {
  /** Список всех сообщений чата в текущем звонке */
  messages: ChatMessageData[];
  /** Активные всплывающие реакции участников (живут 3 секунды) */
  reactions: MeetingReactionItem[];
  /** Множество ID участников с поднятой рукой */
  raisedHandParticipantIds: Set<string>;
  /** Поднята ли рука у локального участника */
  isLocalHandRaised: boolean;
  /** Количество непрочитанных сообщений */
  unreadCount: number;

  /** Отправить текстовое сообщение в чат */
  sendMessage: (text: string) => Promise<boolean>;
  /** Поднять / опустить руку */
  toggleRaiseHand: () => Promise<boolean>;
  /** Отправить эмодзи-реакцию */
  sendReaction: (emoji: string) => Promise<boolean>;
  /** Сбросить счетчик непрочитанных сообщений (например, при открытии сайдбара) */
  resetUnreadCount: () => void;
}

/** Длительность отображения всплывающей реакции (мс) */
const REACTION_LIFETIME_MS = 3000;

export function useMeetingChat({
  room,
  localParticipantId,
  localParticipantName,
}: UseMeetingChatOptions): UseMeetingChatReturn {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [reactions, setReactions] = useState<MeetingReactionItem[]>([]);
  const [raisedHandParticipantIds, setRaisedHandParticipantIds] = useState<
    Set<string>
  >(() => new Set());
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Храним активные таймеры реакций для надежного cleanup при unmount
  const reactionTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const currentLocalId =
    localParticipantId || room?.localParticipant?.identity || "local";
  const currentLocalName =
    localParticipantName || room?.localParticipant?.name || currentLocalId;

  // Обработка входящих сообщений DataChannel
  const handleDataReceived = useCallback(
    (payload: Uint8Array) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data: unknown = JSON.parse(text);

        if (!isDataChannelPayload(data)) {
          return;
        }

        switch (data.type) {
          case "CHAT_MESSAGE": {
            setMessages((prev) => [...prev, data]);
            if (data.senderId !== currentLocalId) {
              setUnreadCount((prev) => prev + 1);
            }
            break;
          }

          case "RAISE_HAND": {
            setRaisedHandParticipantIds((prev) => {
              const next = new Set(prev);
              if (data.raised) {
                next.add(data.participantId);
              } else {
                next.delete(data.participantId);
              }
              return next;
            });
            break;
          }

          case "REACTION": {
            const reactionItem: MeetingReactionItem = {
              id: data.id,
              participantId: data.participantId,
              emoji: data.emoji,
              createdAt: Date.now(),
            };

            setReactions((prev) => [...prev, reactionItem]);

            // Автоматическое удаление реакции через 3 секунды
            const timer = setTimeout(() => {
              setReactions((prev) => prev.filter((r) => r.id !== data.id));
              reactionTimersRef.current.delete(data.id);
            }, REACTION_LIFETIME_MS);

            reactionTimersRef.current.set(data.id, timer);
            break;
          }
        }
      } catch (err) {
        console.warn(
          "[useMeetingChat] Failed to parse DataChannel message:",
          err,
        );
      }
    },
    [currentLocalId],
  );

  // Подписка на событие DataReceived
  useEffect(() => {
    if (!room) return;

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, handleDataReceived]);

  // Cleanup всех таймеров при размонтировании
  useEffect(() => {
    const timers = reactionTimersRef.current;
    return () => {
      timers.forEach((timer) => {
        clearTimeout(timer);
      });
      timers.clear();
    };
  }, []);

  // Отправка данных по DataChannel
  const publishPayload = useCallback(
    async (payload: DataChannelPayload): Promise<boolean> => {
      if (!room || !room.localParticipant) {
        return false;
      }

      try {
        const encoded = new TextEncoder().encode(JSON.stringify(payload));
        await room.localParticipant.publishData(encoded, { reliable: true });
        return true;
      } catch (err) {
        console.error("[useMeetingChat] Failed to publish data:", err);
        return false;
      }
    },
    [room],
  );

  // Отправка сообщения в чат
  const sendMessage = useCallback(
    async (text: string): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed) return false;

      const message: ChatMessageData = {
        type: "CHAT_MESSAGE",
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : String(Date.now()),
        senderId: currentLocalId,
        senderName: currentLocalName,
        text: trimmed,
        timestamp: new Date().toISOString(),
      };

      const published = await publishPayload(message);
      if (published) {
        // Оптимистично добавляем локальному отправителю
        setMessages((prev) => [...prev, message]);
      }
      return published;
    },
    [currentLocalId, currentLocalName, publishPayload],
  );

  // Поднятие / опускание руки
  const isLocalHandRaised = raisedHandParticipantIds.has(currentLocalId);

  const toggleRaiseHand = useCallback(async (): Promise<boolean> => {
    const nextState = !isLocalHandRaised;
    const raiseHandData: RaiseHandData = {
      type: "RAISE_HAND",
      participantId: currentLocalId,
      raised: nextState,
    };

    const published = await publishPayload(raiseHandData);
    if (published) {
      setRaisedHandParticipantIds((prev) => {
        const next = new Set(prev);
        if (nextState) {
          next.add(currentLocalId);
        } else {
          next.delete(currentLocalId);
        }
        return next;
      });
    }
    return published;
  }, [currentLocalId, isLocalHandRaised, publishPayload]);

  // Отправка эмодзи-реакции
  const sendReaction = useCallback(
    async (emoji: string): Promise<boolean> => {
      const reactionId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now());

      const reactionData: ReactionData = {
        type: "REACTION",
        id: reactionId,
        participantId: currentLocalId,
        emoji,
      };

      const published = await publishPayload(reactionData);
      if (published) {
        // Показываем реакцию локально
        const localReactionItem: MeetingReactionItem = {
          id: reactionId,
          participantId: currentLocalId,
          emoji,
          createdAt: Date.now(),
        };

        setReactions((prev) => [...prev, localReactionItem]);

        const timer = setTimeout(() => {
          setReactions((prev) => prev.filter((r) => r.id !== reactionId));
          reactionTimersRef.current.delete(reactionId);
        }, REACTION_LIFETIME_MS);

        reactionTimersRef.current.set(reactionId, timer);
      }
      return published;
    },
    [currentLocalId, publishPayload],
  );

  // Сброс счетчика непрочитанных
  const resetUnreadCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return {
    messages,
    reactions,
    raisedHandParticipantIds,
    isLocalHandRaised,
    unreadCount,
    sendMessage,
    toggleRaiseHand,
    sendReaction,
    resetUnreadCount,
  };
}
