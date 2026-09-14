"use client";

import type { AnyWebSocketEnvelope } from "@packages/dto";
import type {
  Collaborator,
  CursorPosition,
  LanguageId,
} from "@packages/editor";
import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  connectWebSocket,
  type RealtimeConnection,
} from "@/features/realtime/lib/ticket";
import type {
  PeerInfo,
  RunResult,
  SandboxRealtimeMessage,
  WebRTCSignal,
} from "../model/types";
import {
  dispatchSandboxMessage,
  type SandboxCallbacks,
} from "./dispatchSandboxMessage";
import { getAuthUser } from "./getAuthUser";
import {
  getColorForUser,
  mapPeerToCollaborator,
} from "./mapPeerToCollaborator";
import { mapSandboxMessageToEnvelope } from "./mapSandboxMessageToEnvelope";

interface UseSandboxRealtimeOptions {
  roomId: string;
  onRemoteCodeUpdate?: (code: string, language?: LanguageId) => void;
  onRemoteTaskChange?: (taskId: string) => void;
  onRemoteWebRTCSignal?: (signal: WebRTCSignal) => void;
  onRemoteRunResult?: (result: RunResult) => void;
  onPeerJoined?: (peerId: string) => void;
}

export function useSandboxRealtime({
  roomId,
  onRemoteCodeUpdate,
  onRemoteTaskChange,
  onRemoteWebRTCSignal,
  onRemoteRunResult,
  onPeerJoined,
}: UseSandboxRealtimeOptions) {
  // Данные участника: уникальный идентификатор вкладки/клиента для корректной работы P2P и мультиплеера
  const [{ userId, userName }] = useState(() => {
    const auth = getAuthUser();
    const tabSuffix = uuidv4().substring(0, 8);
    return {
      userId: auth.id ? `${auth.id}_${tabSuffix}` : `usr_${tabSuffix}`,
      userName: auth.name || "Участник",
    };
  });

  const [otherPeers, setOtherPeers] = useState<PeerInfo[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

  const isSelfPeer = useCallback(
    (peerId: string) => {
      if (!peerId) return true;
      return peerId === userId;
    },
    [userId],
  );

  const peersRef = useRef<Map<string, PeerInfo>>(new Map());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const wsConnRef = useRef<RealtimeConnection | null>(null);

  // Храним актуальные колбэки в ref, чтобы не пересоздавать подписку при ререндерах
  const callbacksRef = useRef<SandboxCallbacks>({
    onRemoteCodeUpdate,
    onRemoteTaskChange,
    onRemoteWebRTCSignal,
    onRemoteRunResult,
    onPeerJoined,
  });

  useEffect(() => {
    callbacksRef.current = {
      onRemoteCodeUpdate,
      onRemoteTaskChange,
      onRemoteWebRTCSignal,
      onRemoteRunResult,
      onPeerJoined,
    };
  });

  // Отправка сообщений в Go WebSocket сервис и BroadcastChannel
  const sendMessage = useCallback(
    (
      type: SandboxRealtimeMessage["type"],
      payload: SandboxRealtimeMessage["payload"] = {},
    ) => {
      if (!roomId) return;
      const msg: SandboxRealtimeMessage = {
        type,
        roomId,
        senderId: userId,
        senderName: userName,
        payload,
      };

      // 1. Отправка в Go Realtime WebSocket сервис через типизированный маппер
      try {
        const socket = wsConnRef.current?.socket;
        if (socket?.readyState === WebSocket.OPEN) {
          const envelope = mapSandboxMessageToEnvelope(msg, roomId);
          socket.send(JSON.stringify(envelope));
        }
      } catch {
        // Игнорируем сетевые сбои и неустановленное соединение
      }

      // 2. Отправка через BroadcastChannel (локально для вкладок одного браузера)
      if (channelRef.current) {
        try {
          channelRef.current.postMessage(msg);
        } catch {
          // Игнорируем
        }
      }
    },
    [roomId, userId, userName],
  );

  const broadcastCodeUpdate = useCallback(
    (code: string, language: LanguageId) => {
      sendMessage("code-update", { code, language });
    },
    [sendMessage],
  );

  const broadcastCursorMove = useCallback(
    (cursor: CursorPosition) => {
      sendMessage("cursor-move", { cursor });
    },
    [sendMessage],
  );

  const broadcastTaskChange = useCallback(
    (taskId: string) => {
      sendMessage("task-change", { taskId });
    },
    [sendMessage],
  );

  const broadcastWebRTCSignal = useCallback(
    (signal: WebRTCSignal) => {
      sendMessage("webrtc-signal", { signal });
    },
    [sendMessage],
  );

  const broadcastRunResult = useCallback(
    (runResult: RunResult) => {
      sendMessage("run-result", { runResult });
    },
    [sendMessage],
  );

  // 1. Подключение к Go Realtime WebSocket сервису
  useEffect(() => {
    if (typeof window === "undefined" || !roomId) return;

    let isDisposed = false;

    const updatePeers = () => {
      setOtherPeers(Array.from(peersRef.current.values()));
    };

    const handleServerMessage = (raw: string) => {
      try {
        const envelope = JSON.parse(raw) as AnyWebSocketEnvelope;

        if (!envelope || envelope.sessionId !== roomId || !envelope.payload)
          return;

        switch (envelope.type) {
          case "room.sync": {
            const participants = envelope.payload.participants || [];
            peersRef.current.clear();
            for (const p of participants) {
              if (p.userId && !isSelfPeer(p.userId)) {
                peersRef.current.set(p.userId, {
                  id: p.userId,
                  name: p.username || "Участник",
                  role: p.role,
                  color: p.color || getColorForUser(p.userId),
                  lastSeen: Date.now(),
                });
              }
            }
            updatePeers();

            // Восстановление начального состояния кода при синхронизации комнаты
            if (envelope.payload.codeState?.content) {
              callbacksRef.current.onRemoteCodeUpdate?.(
                envelope.payload.codeState.content,
                envelope.payload.codeState.language as LanguageId,
              );
            }
            break;
          }

          case "presence.join": {
            const p = envelope.payload;
            if (p.userId && !isSelfPeer(p.userId)) {
              const hadPeer = peersRef.current.has(p.userId);
              peersRef.current.set(p.userId, {
                id: p.userId,
                name: p.username || "Участник",
                role: p.role,
                color: p.color || getColorForUser(p.userId),
                lastSeen: Date.now(),
              });
              updatePeers();
              if (!hadPeer) {
                callbacksRef.current.onPeerJoined?.(p.userId);
              }
            }
            break;
          }

          case "presence.leave": {
            const p = envelope.payload;
            if (p.userId && peersRef.current.has(p.userId)) {
              peersRef.current.delete(p.userId);
              updatePeers();
            }
            break;
          }

          case "cursor.move": {
            const p = envelope.payload;
            if (p.userId && !isSelfPeer(p.userId)) {
              let existing = peersRef.current.get(p.userId);
              if (!existing) {
                existing = {
                  id: p.userId,
                  name: p.username || "Участник",
                  color: getColorForUser(p.userId),
                  lastSeen: Date.now(),
                };
                peersRef.current.set(p.userId, existing);
              }
              existing.cursor = {
                line: p.line,
                column: p.column,
                selectionEndLine: p.selectionStart,
                selectionEndColumn: p.selectionEnd,
              };
              existing.lastSeen = Date.now();
              updatePeers();
            }
            break;
          }

          case "code.update": {
            const p = envelope.payload;
            if (p.content !== undefined) {
              callbacksRef.current.onRemoteCodeUpdate?.(
                p.content,
                p.language as LanguageId,
              );
            }
            break;
          }

          case "chat.message": {
            const text = envelope.payload.text;
            if (text && typeof text === "string" && text.startsWith("{")) {
              try {
                const parsed = JSON.parse(text) as SandboxRealtimeMessage;
                if (!isSelfPeer(parsed.senderId)) {
                  dispatchSandboxMessage(parsed, callbacksRef.current);
                }
              } catch {
                // Обычное текстовое сообщение
              }
            }
            break;
          }
        }
      } catch {
        // Игнорируем некорректный JSON
      }
    };

    void connectWebSocket(roomId, {
      onMessage: (event) => {
        if (typeof event.data === "string") {
          handleServerMessage(event.data);
        }
      },
      onClose: () => {
        if (!isDisposed) {
          setWsConnected(false);
        }
      },
    })
      .then((conn) => {
        if (isDisposed) {
          conn.close();
        } else {
          wsConnRef.current = conn;
          setWsConnected(true);
        }
      })
      .catch(() => {
        // Фолбэк на BroadcastChannel при отсутствии сети или ошибке авторизации
      });

    return () => {
      isDisposed = true;
      if (wsConnRef.current) {
        wsConnRef.current.close();
        wsConnRef.current = null;
      }
      setWsConnected(false);
    };
  }, [roomId, isSelfPeer]);

  // 2. Локальный BroadcastChannel и localStorage (для мгновенного обмена между вкладками одного браузера)
  useEffect(() => {
    if (typeof window === "undefined" || !roomId) return;

    const channelName = `sandbox_room_${roomId}`;
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(channelName);
      channelRef.current = channel;
    } catch {
      // Фолбэк
    }

    const updatePeersState = () => {
      setOtherPeers(Array.from(peersRef.current.values()));
    };

    const processMessage = (msg: SandboxRealtimeMessage) => {
      if (!msg || msg.roomId !== roomId || isSelfPeer(msg.senderId)) return;

      if (msg.type === "presence-leave") {
        if (peersRef.current.has(msg.senderId)) {
          peersRef.current.delete(msg.senderId);
          updatePeersState();
        }
      } else {
        let existing = peersRef.current.get(msg.senderId);
        const isNew = !existing;
        if (!existing) {
          existing = {
            id: msg.senderId,
            name: msg.senderName || "Собеседник",
            color: getColorForUser(msg.senderId),
            lastSeen: Date.now(),
          };
          peersRef.current.set(msg.senderId, existing);
        }

        if (msg.type === "cursor-move" && msg.payload.cursor) {
          existing.cursor = msg.payload.cursor;
        }
        existing.lastSeen = Date.now();
        updatePeersState();

        if (isNew) {
          updatePeersState();
          callbacksRef.current.onPeerJoined?.(msg.senderId);
          if (msg.type === "presence-ping") {
            try {
              channel?.postMessage({
                type: "presence-ping",
                roomId,
                senderId: userId,
                senderName: userName,
                payload: {},
              });
            } catch {
              // Игнорируем
            }
          }
        }
      }

      dispatchSandboxMessage(msg, callbacksRef.current);
    };

    const handleBroadcastMessage = (
      event: MessageEvent<SandboxRealtimeMessage>,
    ) => {
      processMessage(event.data);
    };

    channel?.addEventListener("message", handleBroadcastMessage);

    return () => {
      channel?.removeEventListener("message", handleBroadcastMessage);
      channel?.close();
      channelRef.current = null;
    };
  }, [roomId, userId, userName, isSelfPeer]);

  // Формируем список соавторов с курсорами для Monaco Editor (исключая самого себя)
  const collaborators: Collaborator[] = otherPeers
    .filter((peer) => !isSelfPeer(peer.id))
    .map(mapPeerToCollaborator);

  return {
    userId,
    userName,
    peerCount: Math.max(1, otherPeers.length + 1),
    otherPeers,
    collaborators,
    wsConnected,
    broadcastCodeUpdate,
    broadcastCursorMove,
    broadcastTaskChange,
    broadcastWebRTCSignal,
    broadcastRunResult,
  };
}
