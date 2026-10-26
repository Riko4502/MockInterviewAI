"use client";

import {
  ConnectionState,
  type Participant,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
} from "livekit-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MeetingParticipantState,
  MeetingRole,
} from "@/entities/meeting-participant";

export interface UseMeetingRoomOptions {
  /** JWT медиа-токен доступа к комнате LiveKit */
  token: string | null;
  /** WebSocket URL сервера LiveKit SFU */
  serverUrl: string | null;
  /** Роль текущего участника (HOST или PARTICIPANT) */
  role?: MeetingRole;
  /** Автоматическое подключение при наличии token и serverUrl */
  autoConnect?: boolean;
  /** Начальное состояние микрофона при входе */
  initialMicrophoneEnabled?: boolean;
  /** Начальное состояние камеры при входе */
  initialCameraEnabled?: boolean;
  /** ID участников с поднятой рукой (из useMeetingChat) */
  raisedHandParticipantIds?: Set<string>;
  /** Callback при отключении от комнаты */
  onDisconnected?: () => void;
  /** Callback при возникновении ошибки */
  onError?: (error: Error) => void;
}

export interface UseMeetingRoomReturn {
  /** Экземпляр комнаты LiveKit (для DataChannel и прямых подписок) */
  room: Room | null;
  /** Текущий статус соединения */
  connectionState: ConnectionState;
  /** Флаг активного подключения */
  isConnected: boolean;
  /** Флаг процесса подключения */
  isConnecting: boolean;
  /** Текст последней ошибки (или null) */
  error: string | null;
  /** Список всех участников встречи (локальный + удаленные) */
  participants: MeetingParticipantState[];
  /** Локальный участник */
  localParticipant: MeetingParticipantState | null;
  /** Участник, который сейчас демонстрирует экран (или null) */
  screenShareParticipant: MeetingParticipantState | null;
  /** Список ID активных спикеров (говорящих в данный момент) */
  activeSpeakerIds: string[];
  /** Включен ли микрофон у локального участника */
  isMicrophoneEnabled: boolean;
  /** Включена ли вебкамера у локального участника */
  isCameraEnabled: boolean;
  /** Включена ли демонстрация экрана у локального участника */
  isScreenSharing: boolean;
  /** Текущий выбранный ID микрофона */
  activeAudioInputId: string;
  /** Текущий выбранный ID камеры */
  activeVideoInputId: string;
  /** Текущий выбранный ID динамиков */
  activeAudioOutputId: string;

  /** Подключиться к комнате */
  connect: () => Promise<boolean>;
  /** Отключиться от комнаты и освободить устройства */
  disconnect: () => Promise<void>;
  /** Переключить микрофон */
  toggleMicrophone: () => Promise<void>;
  /** Установить состояние микрофона */
  setMicrophoneEnabled: (enabled: boolean) => Promise<void>;
  /** Переключить камеру */
  toggleCamera: () => Promise<void>;
  /** Установить состояние камеры */
  setCameraEnabled: (enabled: boolean) => Promise<void>;
  /** Переключить демонстрацию экрана */
  toggleScreenShare: () => Promise<void>;
  /** Запустить демонстрацию экрана */
  startScreenShare: () => Promise<void>;
  /** Остановить демонстрацию экрана */
  stopScreenShare: () => Promise<void>;
  /** Сменить источник микрофона */
  switchAudioInput: (deviceId: string) => Promise<void>;
  /** Сменить источник видеокамеры */
  switchVideoInput: (deviceId: string) => Promise<void>;
  /** Сменить динамики/вывод звука */
  switchAudioOutput: (deviceId: string) => Promise<void>;
}

/** Вспомогательная функция маппинга Participant из LiveKit в модель MeetingParticipantState */
function mapParticipantToState(
  participant: Participant,
  isLocal: boolean,
  localRole: MeetingRole,
  isHandRaised: boolean,
): MeetingParticipantState {
  let role: MeetingRole = isLocal ? localRole : "PARTICIPANT";

  if (!isLocal && participant.metadata) {
    try {
      const parsed = JSON.parse(participant.metadata);
      if (parsed.role === "HOST" || parsed.role === "PARTICIPANT") {
        role = parsed.role;
      }
    } catch {
      if (
        participant.metadata === "HOST" ||
        participant.metadata === "PARTICIPANT"
      ) {
        role = participant.metadata as MeetingRole;
      }
    }
  }

  const cameraTrack =
    participant.getTrackPublication(Track.Source.Camera) ?? null;
  const audioTrack =
    participant.getTrackPublication(Track.Source.Microphone) ?? null;
  const screenShareTrack =
    participant.getTrackPublication(Track.Source.ScreenShare) ?? null;
  const screenShareAudioTrack =
    participant.getTrackPublication(Track.Source.ScreenShareAudio) ?? null;

  const isScreenSharing = Boolean(
    screenShareTrack &&
      !screenShareTrack.isMuted &&
      (isLocal
        ? participant.isScreenShareEnabled
        : Boolean(screenShareTrack.track || screenShareTrack.isSubscribed)),
  );

  return {
    id: participant.identity || participant.sid,
    identity: participant.identity,
    name: participant.name || participant.identity || "Участник",
    isLocal,
    role,
    isSpeaking: participant.isSpeaking,
    isMicrophoneEnabled: participant.isMicrophoneEnabled,
    isCameraEnabled: participant.isCameraEnabled,
    isScreenSharing,
    isHandRaised,
    videoTrack: cameraTrack,
    audioTrack,
    screenShareTrack,
    screenShareAudioTrack,
  };
}

export function useMeetingRoom({
  token,
  serverUrl,
  role = "PARTICIPANT",
  autoConnect = false,
  initialMicrophoneEnabled = false,
  initialCameraEnabled = false,
  raisedHandParticipantIds,
  onDisconnected,
  onError,
}: UseMeetingRoomOptions): UseMeetingRoomReturn {
  const [room, setRoom] = useState<Room | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected,
  );
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<MeetingParticipantState[]>(
    [],
  );
  const [activeSpeakerIds, setActiveSpeakerIds] = useState<string[]>([]);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState<boolean>(
    initialMicrophoneEnabled,
  );
  const [isCameraEnabled, setIsCameraEnabled] =
    useState<boolean>(initialCameraEnabled);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);

  const roomRef = useRef<Room | null>(null);
  const connectionAttemptRef = useRef<number>(0);
  const disconnectPromiseRef = useRef<Promise<void> | null>(null);

  // Синхронизация всех участников комнаты в единый стейт
  const syncParticipants = useCallback(
    (currentRoom: Room) => {
      const result: MeetingParticipantState[] = [];

      // 1. Локальный участник
      if (currentRoom.localParticipant) {
        const isHandRaised = Boolean(
          raisedHandParticipantIds?.has(currentRoom.localParticipant.identity),
        );
        const localState = mapParticipantToState(
          currentRoom.localParticipant,
          true,
          role,
          isHandRaised,
        );
        result.push(localState);
      }

      // 2. Удаленные участники
      currentRoom.remoteParticipants.forEach((remoteParticipant) => {
        const isHandRaised = Boolean(
          raisedHandParticipantIds?.has(remoteParticipant.identity),
        );
        result.push(
          mapParticipantToState(
            remoteParticipant,
            false,
            "PARTICIPANT",
            isHandRaised,
          ),
        );
      });

      setParticipants(result);

      if (currentRoom.localParticipant) {
        setIsMicrophoneEnabled(
          currentRoom.localParticipant.isMicrophoneEnabled,
        );
        setIsCameraEnabled(currentRoom.localParticipant.isCameraEnabled);
        setIsScreenSharing(currentRoom.localParticipant.isScreenShareEnabled);
      }
    },
    [role, raisedHandParticipantIds],
  );

  // Подключение к комнате LiveKit
  const connect = useCallback(async (): Promise<boolean> => {
    if (!token || !serverUrl) {
      const err = new Error(
        "Не переданы token или serverUrl для подключения к LiveKit",
      );
      setError(err.message);
      onError?.(err);
      return false;
    }

    if (disconnectPromiseRef.current) {
      try {
        await disconnectPromiseRef.current;
      } catch {
        // Игнорируем ошибку от предыдущего отключения
      }
    }

    if (roomRef.current?.state === ConnectionState.Connected) {
      return true;
    }

    const attemptId = ++connectionAttemptRef.current;
    setError(null);
    setConnectionState(ConnectionState.Connecting);

    let roomInstance: Room | null = null;

    try {
      roomInstance = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
      });
      const currentRoom = roomInstance;

      // Регистрация слушателей событий
      currentRoom.on(
        RoomEvent.ConnectionStateChanged,
        (state: ConnectionState) => {
          if (attemptId === connectionAttemptRef.current) {
            setConnectionState(state);
          }
        },
      );

      const handleTracksAndParticipants = () => {
        if (attemptId === connectionAttemptRef.current) {
          syncParticipants(currentRoom);
        }
      };

      currentRoom.on(
        RoomEvent.ParticipantConnected,
        handleTracksAndParticipants,
      );
      currentRoom.on(
        RoomEvent.ParticipantDisconnected,
        handleTracksAndParticipants,
      );
      currentRoom.on(RoomEvent.TrackPublished, handleTracksAndParticipants);
      currentRoom.on(RoomEvent.TrackUnpublished, handleTracksAndParticipants);
      currentRoom.on(RoomEvent.TrackSubscribed, handleTracksAndParticipants);
      currentRoom.on(RoomEvent.TrackUnsubscribed, handleTracksAndParticipants);
      currentRoom.on(
        RoomEvent.TrackStreamStateChanged,
        handleTracksAndParticipants,
      );
      currentRoom.on(
        RoomEvent.LocalTrackPublished,
        handleTracksAndParticipants,
      );
      currentRoom.on(
        RoomEvent.LocalTrackUnpublished,
        handleTracksAndParticipants,
      );
      currentRoom.on(RoomEvent.TrackMuted, handleTracksAndParticipants);
      currentRoom.on(RoomEvent.TrackUnmuted, handleTracksAndParticipants);

      currentRoom.on(
        RoomEvent.ActiveSpeakersChanged,
        (speakers: Participant[]) => {
          if (attemptId === connectionAttemptRef.current) {
            setActiveSpeakerIds(speakers.map((s) => s.identity));
            syncParticipants(currentRoom);
          }
        },
      );

      currentRoom.on(RoomEvent.Disconnected, () => {
        if (attemptId === connectionAttemptRef.current) {
          setConnectionState(ConnectionState.Disconnected);
          setParticipants([]);
          setActiveSpeakerIds([]);
          setIsScreenSharing(false);
          onDisconnected?.();
        }
      });

      // Подключаемся к SFU
      await currentRoom.connect(serverUrl, token, { autoSubscribe: true });

      if (attemptId !== connectionAttemptRef.current) {
        await currentRoom.disconnect();
        return false;
      }

      // Применяем начальные состояния устройств из лобби
      if (initialMicrophoneEnabled) {
        await currentRoom.localParticipant
          .setMicrophoneEnabled(true)
          .catch(() => {});
      }
      if (initialCameraEnabled) {
        await currentRoom.localParticipant
          .setCameraEnabled(true)
          .catch(() => {});
      }

      if (roomRef.current && roomRef.current !== currentRoom) {
        await roomRef.current.disconnect().catch(() => {});
      }

      roomRef.current = currentRoom;
      setRoom(currentRoom);
      syncParticipants(currentRoom);
      return true;
    } catch (err) {
      if (roomInstance) {
        await roomInstance.disconnect().catch(() => {});
      }
      if (attemptId !== connectionAttemptRef.current) {
        return false;
      }
      const resolvedError =
        err instanceof Error
          ? err
          : new Error("Ошибка подключения к LiveKit комнате");
      setError(resolvedError.message);
      setConnectionState(ConnectionState.Disconnected);
      onError?.(resolvedError);
      return false;
    }
  }, [
    token,
    serverUrl,
    initialMicrophoneEnabled,
    initialCameraEnabled,
    syncParticipants,
    onDisconnected,
    onError,
  ]);

  // Корректное отключение и освобождение медиа-устройств
  const disconnect = useCallback(async () => {
    connectionAttemptRef.current += 1;
    const roomToDisconnect = roomRef.current;
    roomRef.current = null;

    if (roomToDisconnect) {
      // 1. Принудительно останавливаем локальные медиа-треки в ОС
      try {
        roomToDisconnect.localParticipant.videoTrackPublications.forEach(
          (pub) => {
            pub.track?.stop();
          },
        );
        roomToDisconnect.localParticipant.audioTrackPublications.forEach(
          (pub) => {
            pub.track?.stop();
          },
        );
      } catch {
        // Игнорируем возможные ошибки остановки
      }

      // 2. Отключаем саму комнату
      const disconnPromise = roomToDisconnect.disconnect();
      disconnectPromiseRef.current = disconnPromise;

      try {
        await disconnPromise;
      } catch (err) {
        console.warn("[useMeetingRoom] Disconnect failed:", err);
      } finally {
        if (disconnectPromiseRef.current === disconnPromise) {
          disconnectPromiseRef.current = null;
        }
      }
    }

    setRoom(null);
    setConnectionState(ConnectionState.Disconnected);
    setParticipants([]);
    setActiveSpeakerIds([]);
    setIsScreenSharing(false);
  }, []);

  // Переключение микрофона
  const toggleMicrophone = useCallback(async () => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return;
    const nextState = !currentRoom.localParticipant.isMicrophoneEnabled;
    await currentRoom.localParticipant.setMicrophoneEnabled(nextState);
    syncParticipants(currentRoom);
  }, [syncParticipants]);

  const setMicrophoneEnabled = useCallback(
    async (enabled: boolean) => {
      const currentRoom = roomRef.current;
      if (!currentRoom) return;
      await currentRoom.localParticipant.setMicrophoneEnabled(enabled);
      syncParticipants(currentRoom);
    },
    [syncParticipants],
  );

  // Переключение камеры
  const toggleCamera = useCallback(async () => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return;
    const nextState = !currentRoom.localParticipant.isCameraEnabled;
    await currentRoom.localParticipant.setCameraEnabled(nextState);
    syncParticipants(currentRoom);
  }, [syncParticipants]);

  const setCameraEnabled = useCallback(
    async (enabled: boolean) => {
      const currentRoom = roomRef.current;
      if (!currentRoom) return;
      await currentRoom.localParticipant.setCameraEnabled(enabled);
      syncParticipants(currentRoom);
    },
    [syncParticipants],
  );

  // Управление демонстрацией экрана
  const startScreenShare = useCallback(async () => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return;
    await currentRoom.localParticipant.setScreenShareEnabled(true, {
      audio: true,
    });
    syncParticipants(currentRoom);
  }, [syncParticipants]);

  const stopScreenShare = useCallback(async () => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return;
    await currentRoom.localParticipant.setScreenShareEnabled(false);
    syncParticipants(currentRoom);
  }, [syncParticipants]);

  const toggleScreenShare = useCallback(async () => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return;
    if (currentRoom.localParticipant.isScreenShareEnabled) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [startScreenShare, stopScreenShare]);

  // Смена аудио/видео устройств
  const [activeAudioInputId, setActiveAudioInputId] = useState<string>("");
  const [activeVideoInputId, setActiveVideoInputId] = useState<string>("");
  const [activeAudioOutputId, setActiveAudioOutputId] = useState<string>("");

  const switchAudioInput = useCallback(async (deviceId: string) => {
    setActiveAudioInputId(deviceId);
    const currentRoom = roomRef.current;
    if (!currentRoom) return;
    try {
      await currentRoom.switchActiveDevice("audioinput", deviceId);
    } catch (err) {
      console.warn(
        "[useMeetingRoom] switchActiveDevice audioinput failed:",
        err,
      );
    }
  }, []);

  const switchVideoInput = useCallback(async (deviceId: string) => {
    setActiveVideoInputId(deviceId);
    const currentRoom = roomRef.current;
    if (!currentRoom) return;
    try {
      await currentRoom.switchActiveDevice("videoinput", deviceId);
    } catch (err) {
      console.warn(
        "[useMeetingRoom] switchActiveDevice videoinput failed:",
        err,
      );
    }
  }, []);

  const switchAudioOutput = useCallback(async (deviceId: string) => {
    setActiveAudioOutputId(deviceId);
    const currentRoom = roomRef.current;
    if (!currentRoom) return;
    try {
      await currentRoom.switchActiveDevice("audiooutput", deviceId);
    } catch (err) {
      console.warn(
        "[useMeetingRoom] switchActiveDevice audiooutput failed:",
        err,
      );
    }
  }, []);

  // Синхронизация при изменении списка поднятых рук
  useEffect(() => {
    if (roomRef.current) {
      syncParticipants(roomRef.current);
    }
  }, [syncParticipants]);

  // Автоматическое подключение при наличии токена
  useEffect(() => {
    if (autoConnect && token && serverUrl) {
      connect();
    }
  }, [autoConnect, token, serverUrl, connect]);

  // Cleanup при размонтировании
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const localParticipant = useMemo(
    () => participants.find((p) => p.isLocal) ?? null,
    [participants],
  );

  const screenShareParticipant = useMemo(
    () => participants.find((p) => p.isScreenSharing) ?? null,
    [participants],
  );

  return {
    room,
    connectionState,
    isConnected: connectionState === ConnectionState.Connected,
    isConnecting: connectionState === ConnectionState.Connecting,
    error,
    participants,
    localParticipant,
    screenShareParticipant,
    activeSpeakerIds,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenSharing,
    activeAudioInputId,
    activeVideoInputId,
    activeAudioOutputId,
    connect,
    disconnect,
    toggleMicrophone,
    setMicrophoneEnabled,
    toggleCamera,
    setCameraEnabled,
    toggleScreenShare,
    startScreenShare,
    stopScreenShare,
    switchAudioInput,
    switchVideoInput,
    switchAudioOutput,
  };
}
