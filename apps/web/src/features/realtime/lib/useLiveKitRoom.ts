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
  const isConnectingRef = useRef<boolean>(false);

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
  const connect = useCallback(async () => {
    if (
      isConnectingRef.current ||
      roomRef.current?.state === ConnectionState.Connected
    ) {
      return;
    }

    isConnectingRef.current = true;
    setError(null);

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

      // Соединение отменили (размонтирование/смена sessionId) во время запроса токена
      if (!isConnectingRef.current) {
        return;
      }

      if (!token || !serverUrl) {
        throw new Error("Не удалось получить токен доступа к LiveKit");
      }

      // 2. Создаем экземпляр LiveKit Room
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
      });

      roomRef.current = newRoom;
      setRoom(newRoom);

      // 3. Подписываемся на события комнаты
      newRoom.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        setConnectionState(state);
      });

      newRoom.on(
        RoomEvent.TrackSubscribed,
        (
          _track: RemoteTrack,
          _publication: RemoteTrackPublication,
          _participant: RemoteParticipant,
        ) => {
          updateRemoteStream(newRoom);
        },
      );

      newRoom.on(
        RoomEvent.TrackUnsubscribed,
        (
          _track: RemoteTrack,
          _publication: RemoteTrackPublication,
          _participant: RemoteParticipant,
        ) => {
          updateRemoteStream(newRoom);
        },
      );

      newRoom.on(RoomEvent.LocalTrackPublished, () => {
        updateLocalStream(newRoom);
      });

      newRoom.on(RoomEvent.LocalTrackUnpublished, () => {
        updateLocalStream(newRoom);
      });

      newRoom.on(RoomEvent.TrackMuted, () => {
        updateLocalStream(newRoom);
        updateRemoteStream(newRoom);
      });

      newRoom.on(RoomEvent.TrackUnmuted, () => {
        updateLocalStream(newRoom);
        updateRemoteStream(newRoom);
      });

      newRoom.on(RoomEvent.TrackPublished, () => {
        updateRemoteStream(newRoom);
      });

      newRoom.on(RoomEvent.TrackUnpublished, () => {
        updateRemoteStream(newRoom);
      });

      newRoom.on(
        RoomEvent.ParticipantConnected,
        (_participant: RemoteParticipant) => {
          updateRemoteStream(newRoom);
        },
      );

      newRoom.on(
        RoomEvent.ParticipantDisconnected,
        (_participant: RemoteParticipant) => {
          updateRemoteStream(newRoom);
        },
      );

      newRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        setActiveSpeakers(speakers);
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        setConnectionState(ConnectionState.Disconnected);
        setLocalStream(null);
        setRemoteStream(null);
        setRemoteParticipants([]);
      });

      // 4. Устанавливаем соединение с сервером
      await newRoom.connect(serverUrl, token);

      // Соединение отменили во время подключения
      if (roomRef.current !== newRoom) {
        await newRoom.disconnect();
        return;
      }

      // Синхронизируем уже подключенных участников и их треки
      updateRemoteStream(newRoom);

      // 5. Микрофон и камера по умолчанию выключены
      setIsCameraEnabled(false);
      setIsMicrophoneEnabled(false);
      updateLocalStream(newRoom);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Ошибка подключения к LiveKit медиасерверу";
      setError(msg);
      setConnectionState(ConnectionState.Disconnected);
      throw err;
    } finally {
      isConnectingRef.current = false;
    }
  }, [sessionId, updateLocalStream, updateRemoteStream]);

  // Отключение от комнаты
  const disconnect = useCallback(async () => {
    isConnectingRef.current = false;
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    setRoom(null);
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
