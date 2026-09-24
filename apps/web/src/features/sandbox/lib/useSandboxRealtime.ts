"use client";

import type { AnyWebSocketEnvelope } from "@packages/dto";
import type { LanguageId } from "@packages/editor";
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
import { getColorForUser } from "./mapPeerToCollaborator";
import { mapSandboxMessageToEnvelope } from "./mapSandboxMessageToEnvelope";

interface PendingTaskState {
  id: string;
  taskId: string;
  language?: LanguageId;
}

interface UseSandboxRealtimeOptions {
  roomId: string;
  onRemoteTaskChange?: (taskId: string, language?: LanguageId) => void;
  onRemoteWebRTCSignal?: (signal: WebRTCSignal) => void;
  onRemoteRunResult?: (result: RunResult) => void;
  onPeerJoined?: (peerId: string) => void;
}

export function useSandboxRealtime({
  roomId,
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

  const pendingTaskRef = useRef<PendingTaskState | null>(null);

  const isSelfServerPeer = useCallback(
    (peerId: string) => {
      if (!peerId) return true;
      if (peerId === userId) return true;
      const auth = getAuthUser();
      if (auth.id && (peerId === auth.id || peerId.startsWith(`${auth.id}_`))) {
        return true;
      }
      return false;
    },
    [userId],
  );

  const isSelfLocalPeer = useCallback(
    (peerId: string) => {
      if (!peerId) return true;
      return peerId === userId;
    },
    [userId],
  );

  const peersRef = useRef<Map<string, PeerInfo>>(new Map());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const wsConnRef = useRef<RealtimeConnection | null>(null);
  const webRTCSignalListenersRef = useRef<Set<(signal: WebRTCSignal) => void>>(
    new Set(),
  );
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  const markMessageSeen = useCallback((id?: string) => {
    if (!id) return false;
    if (seenMessageIdsRef.current.has(id)) {
      return true;
    }
    seenMessageIdsRef.current.add(id);
    if (seenMessageIdsRef.current.size > 1000) {
      const oldest = seenMessageIdsRef.current.values().next().value;
      if (oldest) {
        seenMessageIdsRef.current.delete(oldest);
      }
    }
    return false;
  }, []);

  const subscribeWebRTCSignal = useCallback(
    (handler: (signal: WebRTCSignal) => void) => {
      webRTCSignalListenersRef.current.add(handler);
      return () => {
        webRTCSignalListenersRef.current.delete(handler);
      };
    },
    [],
  );

  const envelopeListenersRef = useRef<
    Set<(envelope: AnyWebSocketEnvelope) => void>
  >(new Set());

  const subscribeEnvelope = useCallback(
    (listener: (envelope: AnyWebSocketEnvelope) => void) => {
      envelopeListenersRef.current.add(listener);
      return () => {
        envelopeListenersRef.current.delete(listener);
      };
    },
    [],
  );

  const sendEnvelope = useCallback((envelope: AnyWebSocketEnvelope) => {
    try {
      const socket = wsConnRef.current?.socket;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(envelope));
      }
    } catch {
      // Игнорируем сетевые сбои
    }
  }, []);

  const getSocket = useCallback(() => {
    return wsConnRef.current?.socket ?? null;
  }, []);

  // Храним актуальные колбэки в ref, чтобы не пересоздавать подписку при ререндерах
  const callbacksRef = useRef<SandboxCallbacks>({
    onRemoteTaskChange,
    onRemoteWebRTCSignal: (signal: WebRTCSignal) => {
      onRemoteWebRTCSignal?.(signal);
      webRTCSignalListenersRef.current.forEach((listener) => {
        try {
          listener(signal);
        } catch (err) {
          console.error(
            "[useSandboxRealtime] Error in WebRTC signal listener:",
            err,
          );
        }
      });
    },
    onRemoteRunResult,
    onPeerJoined,
  });

  useEffect(() => {
    callbacksRef.current = {
      onRemoteTaskChange,
      onRemoteWebRTCSignal: (signal: WebRTCSignal) => {
        onRemoteWebRTCSignal?.(signal);
        webRTCSignalListenersRef.current.forEach((listener) => {
          try {
            listener(signal);
          } catch (err) {
            console.error(
              "[useSandboxRealtime] Error in WebRTC signal listener:",
              err,
            );
          }
        });
      },
      onRemoteRunResult,
      onPeerJoined,
    };
  });

  // Отправка сообщений в Go WebSocket сервис и BroadcastChannel
  const sendMessage = useCallback(
    (
      type: SandboxRealtimeMessage["type"],
      payload: SandboxRealtimeMessage["payload"] = {},
      customId?: string,
    ) => {
      if (!roomId) return "";
      const msgId = customId || uuidv4();
      const msg: SandboxRealtimeMessage = {
        id: msgId,
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

      return msgId;
    },
    [roomId, userId, userName],
  );

  const broadcastTaskChange = useCallback(
    (taskId: string, lang?: LanguageId) => {
      const id = uuidv4();
      pendingTaskRef.current = { id, taskId, language: lang };
      const taskKey = lang ? `${taskId}:${lang}` : taskId;
      if (lang) {
        try {
          const socket = wsConnRef.current?.socket;
          if (socket?.readyState === WebSocket.OPEN) {
            const envelope: AnyWebSocketEnvelope = {
              type: "task.switch",
              version: 1,
              sessionId: roomId,
              requestId: `req_switch_${id}`,
              timestamp: new Date().toISOString(),
              payload: { taskKey },
            };
            socket.send(JSON.stringify(envelope));
          }
        } catch {
          // Игнорируем сетевые сбои
        }
      }
      sendMessage("task-change", { taskId, language: lang }, id);
    },
    [roomId, sendMessage],
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

        // Уведомляем внешних подписчиков конвертов (например, RealtimeYjsProvider)
        envelopeListenersRef.current.forEach((listener) => {
          try {
            listener(envelope);
          } catch (err) {
            console.error(
              "[useSandboxRealtime] Error in envelope listener:",
              err,
            );
          }
        });

        switch (envelope.type) {
          case "task.switched": {
            const taskKey = (envelope.payload as { taskKey?: string })?.taskKey;
            if (taskKey) {
              const parts = taskKey.split(":");
              const newTaskId = parts[0];
              const newLang = parts[1] as LanguageId | undefined;
              if (newTaskId) {
                callbacksRef.current.onRemoteTaskChange?.(newTaskId, newLang);
              }
            }
            break;
          }

          case "system.ack": {
            const targetId = envelope.payload?.targetRequestId;
            if (targetId) {
              if (pendingTaskRef.current?.id === targetId) {
                pendingTaskRef.current = null;
              }
            }
            break;
          }

          case "room.sync": {
            const participants = envelope.payload.participants || [];
            peersRef.current.clear();
            for (const p of participants) {
              if (p.userId && !isSelfServerPeer(p.userId)) {
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
            break;
          }

          case "presence.join": {
            const p = envelope.payload;
            if (p.userId && !isSelfServerPeer(p.userId)) {
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

          case "chat.message": {
            const reqId = envelope.requestId;
            if (pendingTaskRef.current?.id === reqId) {
              pendingTaskRef.current = null;
            }
            const serverSenderId = envelope.payload.senderId;
            if (!serverSenderId) {
              break;
            }
            const serverSenderName = envelope.payload.senderName;
            const text = envelope.payload.text;
            if (text && typeof text === "string" && text.startsWith("{")) {
              try {
                const parsed = JSON.parse(text) as SandboxRealtimeMessage;
                if (pendingTaskRef.current?.id === parsed.id) {
                  pendingTaskRef.current = null;
                }
                parsed.senderId = serverSenderId;
                if (serverSenderName) {
                  parsed.senderName = serverSenderName;
                }
                if (parsed.payload?.signal) {
                  parsed.payload.signal.senderId = serverSenderId;
                }
                if (!isSelfServerPeer(parsed.senderId)) {
                  if (markMessageSeen(parsed.id)) {
                    break;
                  }
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
          // Повторная отправка локального буфера кода выполняется исключительно в обработчике room.sync
          // после проверки совпадения базовой ревизии (baseVersion === serverVersion).
          if (pendingTaskRef.current) {
            sendMessage(
              "task-change",
              {
                taskId: pendingTaskRef.current.taskId,
                language: pendingTaskRef.current.language,
              },
              pendingTaskRef.current.id,
            );
          }
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
  }, [roomId, isSelfServerPeer, markMessageSeen, sendMessage]);

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
      if (!msg || msg.roomId !== roomId || isSelfLocalPeer(msg.senderId))
        return;

      if (markMessageSeen(msg.id)) {
        return;
      }

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

        existing.lastSeen = Date.now();
        updatePeersState();

        if (isNew) {
          updatePeersState();
          callbacksRef.current.onPeerJoined?.(msg.senderId);
          if (msg.type === "presence-ping") {
            try {
              channel?.postMessage({
                id: uuidv4(),
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
      try {
        channel?.postMessage({
          id: uuidv4(),
          type: "presence-leave",
          roomId,
          senderId: userId,
          senderName: userName,
          payload: {},
        });
      } catch {
        // Игнорируем
      }
      channel?.removeEventListener("message", handleBroadcastMessage);
      channel?.close();
      channelRef.current = null;
    };
  }, [roomId, userId, userName, isSelfLocalPeer, markMessageSeen]);

  return {
    userId,
    userName,
    peerCount: Math.max(1, otherPeers.length + 1),
    otherPeers,
    wsConnected,
    broadcastTaskChange,
    broadcastWebRTCSignal,
    broadcastRunResult,
    subscribeWebRTCSignal,
    registerWebRTCSignalHandler: subscribeWebRTCSignal,
    subscribeEnvelope,
    sendEnvelope,
    getSocket,
  };
}
