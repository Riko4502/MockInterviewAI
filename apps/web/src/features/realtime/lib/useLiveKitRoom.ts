"use client";

import { realtimeControllerGetMediaToken } from "@packages/api";
import {
  ConnectionState,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  Room,
  RoomEvent,
  VideoPresets,
} from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseLiveKitRoomOptions {
  sessionId: string;
  autoConnect?: boolean;
}

export function useLiveKitRoom({
  sessionId,
  autoConnect = false,
}: UseLiveKitRoomOptions) {
  const [room, setRoom] = useState<Room | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected,
  );
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<
    RemoteParticipant[]
  >([]);
  const [activeSpeakers, setActiveSpeakers] = useState<Participant[]>([]);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] =
    useState<boolean>(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState<boolean>(false);
  const [isScreenShareEnabled, setIsScreenShareEnabled] =
    useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const connectionAttemptRef = useRef<number>(0);
  const disconnectPromiseRef = useRef<Promise<void> | null>(null);

  // Обновление локального MediaStream из локальных публикаций
  const updateLocalStream = useCallback((currentRoom: Room) => {
    const stream = new MediaStream();
    currentRoom.localParticipant.videoTrackPublications.forEach((pub) => {
      if (pub.track?.mediaStreamTrack) {
        stream.addTrack(pub.track.mediaStreamTrack);
      }
    });
    currentRoom.localParticipant.audioTrackPublications.forEach((pub) => {
      if (pub.track?.mediaStreamTrack) {
        stream.addTrack(pub.track.mediaStreamTrack);
      }
    });
    setLocalStream(stream.getTracks().length > 0 ? stream : null);
  }, []);

  // Обновление удаленного MediaStream из всех удаленных участников
  const updateRemoteStream = useCallback((currentRoom: Room) => {
    const tracks: MediaStreamTrack[] = [];
    currentRoom.remoteParticipants.forEach((p) => {
      p.trackPublications.forEach((pub) => {
        if (pub.track?.mediaStreamTrack) {
          tracks.push(pub.track.mediaStreamTrack);
        }
      });
    });
    setRemoteStream(tracks.length > 0 ? new MediaStream(tracks) : null);
    setRemoteParticipants(Array.from(currentRoom.remoteParticipants.values()));
  }, []);

  // Подключение к комнате LiveKit SFU
  const connect = useCallback(async (): Promise<boolean> => {
    // Если идет процесс отключения предыдущей комнаты, ожидаем его полного завершения
    if (disconnectPromiseRef.current) {
      await disconnectPromiseRef.current;
    }

    if (roomRef.current?.state === ConnectionState.Connected) {
      return true;
    }

    const attemptId = ++connectionAttemptRef.current;
    setError(null);
    setConnectionState(ConnectionState.Connecting);

    let newRoom: Room | null = null;

    try {
      const isValid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          sessionId,
        );
      if (!isValid) {
        throw new Error("ID сессии должен быть валидным UUID");
      }

      // 1. Получаем join-токен от API (apps/api: POST /realtime/media-token)
      const { token, serverUrl } = await realtimeControllerGetMediaToken({
        sessionId,
      });

      // Соединение отменили или запущена новая попытка во время запроса токена
      if (attemptId !== connectionAttemptRef.current) {
        return false;
      }

      if (!token || !serverUrl) {
        throw new Error("Не удалось получить токен доступа к LiveKit");
      }

      // 2. Создаем экземпляр LiveKit Room
      const currentRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
      });
      newRoom = currentRoom;

      // 3. Подписываемся на события комнаты
      currentRoom.on(
        RoomEvent.ConnectionStateChanged,
        (state: ConnectionState) => {
          if (attemptId === connectionAttemptRef.current) {
            setConnectionState(state);
          }
        },
      );

      currentRoom.on(
        RoomEvent.TrackSubscribed,
        (
          _track: RemoteTrack,
          _publication: RemoteTrackPublication,
          _participant: RemoteParticipant,
        ) => {
          if (attemptId === connectionAttemptRef.current) {
            updateRemoteStream(currentRoom);
          }
        },
      );

      currentRoom.on(
        RoomEvent.TrackUnsubscribed,
        (
          _track: RemoteTrack,
          _publication: RemoteTrackPublication,
          _participant: RemoteParticipant,
        ) => {
          if (attemptId === connectionAttemptRef.current) {
            updateRemoteStream(currentRoom);
          }
        },
      );

      currentRoom.on(RoomEvent.LocalTrackPublished, () => {
        if (attemptId === connectionAttemptRef.current) {
          updateLocalStream(currentRoom);
        }
      });

      currentRoom.on(RoomEvent.LocalTrackUnpublished, () => {
        if (attemptId === connectionAttemptRef.current) {
          updateLocalStream(currentRoom);
        }
      });

      currentRoom.on(RoomEvent.TrackMuted, () => {
        if (attemptId === connectionAttemptRef.current) {
          updateLocalStream(currentRoom);
          updateRemoteStream(currentRoom);
        }
      });

      currentRoom.on(RoomEvent.TrackUnmuted, () => {
        if (attemptId === connectionAttemptRef.current) {
          updateLocalStream(currentRoom);
          updateRemoteStream(currentRoom);
        }
      });

      currentRoom.on(RoomEvent.TrackPublished, () => {
        if (attemptId === connectionAttemptRef.current) {
          updateRemoteStream(currentRoom);
        }
      });

      currentRoom.on(RoomEvent.TrackUnpublished, () => {
        if (attemptId === connectionAttemptRef.current) {
          updateRemoteStream(currentRoom);
        }
      });

      currentRoom.on(
        RoomEvent.ParticipantConnected,
        (_participant: RemoteParticipant) => {
          if (attemptId === connectionAttemptRef.current) {
            updateRemoteStream(currentRoom);
          }
        },
      );

      currentRoom.on(
        RoomEvent.ParticipantDisconnected,
        (_participant: RemoteParticipant) => {
          if (attemptId === connectionAttemptRef.current) {
            updateRemoteStream(currentRoom);
          }
        },
      );

      currentRoom.on(
        RoomEvent.ActiveSpeakersChanged,
        (speakers: Participant[]) => {
          if (attemptId === connectionAttemptRef.current) {
            setActiveSpeakers(speakers);
          }
        },
      );

      currentRoom.on(RoomEvent.Disconnected, () => {
        if (attemptId === connectionAttemptRef.current) {
          setConnectionState(ConnectionState.Disconnected);
          setLocalStream(null);
          setRemoteStream(null);
          setRemoteParticipants([]);
        }
      });

      // 4. Устанавливаем соединение с сервером
      await currentRoom.connect(serverUrl, token);

      // Соединение отменили или началась новая попытка во время подключения
      if (attemptId !== connectionAttemptRef.current) {
        await currentRoom.disconnect();
        return false;
      }

      if (roomRef.current && roomRef.current !== currentRoom) {
        await roomRef.current.disconnect();
      }

      roomRef.current = currentRoom;
      setRoom(currentRoom);

      // Синхронизируем уже подключенных участников и их треки
      updateRemoteStream(currentRoom);

      // 5. Микрофон и камера по умолчанию выключены
      setIsCameraEnabled(false);
      setIsMicrophoneEnabled(false);
      updateLocalStream(currentRoom);
      return true;
    } catch (err) {
      if (newRoom) {
        await newRoom.disconnect().catch(() => {});
      }
      if (attemptId !== connectionAttemptRef.current) {
        return false;
      }
      const msg =
        err instanceof Error
          ? err.message
          : "Ошибка подключения к LiveKit медиасерверу";
      setError(msg);
      setConnectionState(ConnectionState.Disconnected);
      throw err;
    }
  }, [sessionId, updateLocalStream, updateRemoteStream]);

  // Отключение от комнаты
  const disconnect = useCallback(async () => {
    connectionAttemptRef.current += 1;
    const roomToDisconnect = roomRef.current;
    roomRef.current = null;

    if (roomToDisconnect) {
      const disconnPromise = (async () => {
        try {
          await roomToDisconnect.disconnect();
        } catch (err) {
          console.warn("[useLiveKitRoom] Disconnect failed:", err);
        }
      })();

      disconnectPromiseRef.current = disconnPromise;

      try {
        await disconnPromise;
      } finally {
        if (disconnectPromiseRef.current === disconnPromise) {
          disconnectPromiseRef.current = null;
        }
      }
    }

    setRoom((prev) => (prev === roomToDisconnect ? null : prev));
    setConnectionState(ConnectionState.Disconnected);
    setLocalStream(null);
    setRemoteStream(null);
    setRemoteParticipants([]);
    setIsScreenShareEnabled(false);
    setIsCameraEnabled(false);
    setIsMicrophoneEnabled(false);
  }, []);

  // Переключение микрофона
  const toggleMicrophone = useCallback(async () => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return;
    const nextState = !isMicrophoneEnabled;
    try {
      await currentRoom.localParticipant.setMicrophoneEnabled(nextState);
      setIsMicrophoneEnabled(nextState);
      updateLocalStream(currentRoom);
    } catch (err) {
      console.error("[useLiveKitRoom] Failed to toggle microphone:", err);
    }
  }, [isMicrophoneEnabled, updateLocalStream]);

  // Переключение камеры
  const toggleCamera = useCallback(async () => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return;
    const nextState = !isCameraEnabled;
    try {
      await currentRoom.localParticipant.setCameraEnabled(nextState);
      setIsCameraEnabled(nextState);
      updateLocalStream(currentRoom);
    } catch (err) {
      console.error("[useLiveKitRoom] Failed to toggle camera:", err);
    }
  }, [isCameraEnabled, updateLocalStream]);

  // Переключение демонстрации экрана
  const toggleScreenShare = useCallback(async () => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return;
    const nextState = !isScreenShareEnabled;
    try {
      await currentRoom.localParticipant.setScreenShareEnabled(nextState);
      setIsScreenShareEnabled(nextState);
      updateLocalStream(currentRoom);
    } catch (err) {
      console.error("[useLiveKitRoom] Failed to toggle screen share:", err);
    }
  }, [isScreenShareEnabled, updateLocalStream]);

  const isRemoteVideoOff =
    remoteParticipants.length === 0 ||
    !remoteParticipants.some((p) =>
      Array.from(p.videoTrackPublications.values()).some(
        (pub) => pub.track && !pub.isMuted,
      ),
    );

  const isRemoteAudioMuted =
    remoteParticipants.length === 0 ||
    !remoteParticipants.some((p) =>
      Array.from(p.audioTrackPublications.values()).some(
        (pub) => pub.track && !pub.isMuted,
      ),
    );

  useEffect(() => {
    if (autoConnect && sessionId) {
      connect().catch(() => {
        // Ошибка уже отражена в состоянии error
      });
    }

    return () => {
      void disconnect();
    };
  }, [autoConnect, sessionId, connect, disconnect]);

  return {
    room,
    connectionState,
    isConnected: connectionState === ConnectionState.Connected,
    isConnecting: connectionState === ConnectionState.Connecting,
    localStream,
    remoteStream,
    remoteParticipants,
    activeSpeakers,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
    isRemoteVideoOff,
    isRemoteAudioMuted,
    error,
    connect,
    disconnect,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
  };
}
