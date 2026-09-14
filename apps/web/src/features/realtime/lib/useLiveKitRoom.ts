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
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState<boolean>(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState<boolean>(true);
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

      // Синхронизируем уже подключенных участников и их треки
      updateRemoteStream(newRoom);

      // 5. Включаем микрофон и камеру по умолчанию
      try {
        await newRoom.localParticipant.enableCameraAndMicrophone();
        setIsCameraEnabled(newRoom.localParticipant.isCameraEnabled);
        setIsMicrophoneEnabled(newRoom.localParticipant.isMicrophoneEnabled);
        updateLocalStream(newRoom);
      } catch (mediaErr) {
        console.warn("[LiveKit] Camera/Mic access warning:", mediaErr);
        try {
          await newRoom.localParticipant.setMicrophoneEnabled(true);
          setIsMicrophoneEnabled(true);
          setIsCameraEnabled(false);
          updateLocalStream(newRoom);
        } catch {
          // Игнорируем
        }
      }
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
  }, []);

  // Переключение микрофона
  const toggleMicrophone = useCallback(async () => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return;
    const nextState = !isMicrophoneEnabled;
    await currentRoom.localParticipant.setMicrophoneEnabled(nextState);
    setIsMicrophoneEnabled(nextState);
    updateLocalStream(currentRoom);
  }, [isMicrophoneEnabled, updateLocalStream]);

  // Переключение камеры
  const toggleCamera = useCallback(async () => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return;
    const nextState = !isCameraEnabled;
    await currentRoom.localParticipant.setCameraEnabled(nextState);
    setIsCameraEnabled(nextState);
    updateLocalStream(currentRoom);
  }, [isCameraEnabled, updateLocalStream]);

  // Переключение демонстрации экрана
  const toggleScreenShare = useCallback(async () => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return;
    const nextState = !isScreenShareEnabled;
    await currentRoom.localParticipant.setScreenShareEnabled(nextState);
    setIsScreenShareEnabled(nextState);
    updateLocalStream(currentRoom);
  }, [isScreenShareEnabled, updateLocalStream]);

  useEffect(() => {
    if (autoConnect && sessionId) {
      void connect();
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
    error,
    connect,
    disconnect,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
  };
}
