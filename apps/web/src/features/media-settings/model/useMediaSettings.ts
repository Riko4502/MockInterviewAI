"use client";

import {
  getProfileControllerGetDeviceSettingsQueryKey,
  useProfileControllerGetDeviceSettings,
  useProfileControllerUpdateDeviceSettings,
} from "@packages/api";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/entities/session";
import { useCurrentUser } from "@/entities/user";
import { playChimeSound } from "../lib/soundTest";
import {
  getClientDeviceId,
  getDeviceName,
  loadStoredMediaSettings,
  saveStoredMediaSettings,
} from "./mediaSettingsStorage";
import type { MediaSettings, MediaSettingsContextValue } from "./types";

type Listener = (settings: MediaSettings) => void;
const listeners = new Set<Listener>();

let currentSettings: MediaSettings = loadStoredMediaSettings();

function updateSettings(updater: (prev: MediaSettings) => MediaSettings) {
  currentSettings = updater(currentSettings);
  saveStoredMediaSettings(currentSettings);
  listeners.forEach((listener) => {
    listener(currentSettings);
  });
}

function matchDevice(
  devices: MediaDeviceInfo[],
  preferredLabel?: string | null,
  currentId?: string,
): string {
  if (devices.length === 0) return "";
  if (currentId && devices.some((d) => d.deviceId === currentId)) {
    return currentId;
  }
  if (preferredLabel) {
    const exact = devices.find((d) => d.label && d.label === preferredLabel);
    if (exact) return exact.deviceId;
    const partial = devices.find((d) =>
      d.label?.toLowerCase().includes(preferredLabel.toLowerCase()),
    );
    if (partial) return partial.deviceId;
  }
  const defaultDev = devices.find((d) => d.deviceId === "default");
  return defaultDev ? defaultDev.deviceId : devices[0].deviceId;
}

interface PendingSnapshot {
  settings: MediaSettings;
  revision: number;
}

interface DeviceSyncState {
  isSaving: boolean;
  pendingSnapshot: PendingSnapshot | null;
  syncTimeout: ReturnType<typeof setTimeout> | null;
  localRevision: number;
  committedRevision: number;
  initialSyncDone: boolean;
  activeMutate?: (
    variables: Parameters<
      ReturnType<typeof useProfileControllerUpdateDeviceSettings>["mutate"]
    >[0],
    options?: Parameters<
      ReturnType<typeof useProfileControllerUpdateDeviceSettings>["mutate"]
    >[1],
  ) => void;
  activeQueryClient?: ReturnType<typeof useQueryClient>;
}

const deviceSyncQueues = new Map<string, DeviceSyncState>();

export function getDeviceSyncQueue(clientId: string): DeviceSyncState {
  let queue = deviceSyncQueues.get(clientId);
  if (!queue) {
    queue = {
      isSaving: false,
      pendingSnapshot: null,
      syncTimeout: null,
      localRevision: 0,
      committedRevision: 0,
      initialSyncDone: false,
    };
    deviceSyncQueues.set(clientId, queue);
  }
  return queue;
}

export function clearDeviceSyncQueuesForTesting(): void {
  deviceSyncQueues.clear();
  currentSettings = loadStoredMediaSettings();
  listeners.clear();
}

export function useMediaSettings(): MediaSettingsContextValue {
  const session = useSession({ optional: true });
  const isAuthenticated = session?.isAuthenticated ?? false;

  const { data: currentUser } = useCurrentUser({
    enabled: isAuthenticated && typeof window !== "undefined",
  });
  const userId = currentUser?.id;

  const [settings, setSettings] = useState<MediaSettings>(currentSettings);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);

  const clientId =
    typeof window !== "undefined" ? getClientDeviceId() : "client-init";

  const { data: serverSettings, isFetching: isFetchingServerSettings } =
    useProfileControllerGetDeviceSettings(
      { clientId },
      {
        query: {
          enabled: isAuthenticated && typeof window !== "undefined",
        },
      },
    );

  const queryClient = useQueryClient();
  const updateMutation = useProfileControllerUpdateDeviceSettings();
  const { mutate } = updateMutation;

  const queue = getDeviceSyncQueue(clientId);
  queue.activeMutate = mutate;
  queue.activeQueryClient = queryClient;

  const hydrationRevisionRef = useRef(0);
  const wasFetchingServerSettingsRef = useRef(false);

  const prevUserIdRef = useRef<string | undefined>(userId);
  const prevClientIdRef = useRef<string>(clientId);
  const prevIsAuthenticatedRef = useRef<boolean>(isAuthenticated);

  // Отправка отложенного снимка с гарантией сериализации: не более одного активного PUT на устройство
  const sendPendingSnapshot = useCallback(() => {
    // Если дебаунс ещё тикает, ждём его окончания
    if (queue.syncTimeout !== null) {
      return;
    }

    // Если нет данных для сохранения или предыдущий PUT ещё выполняется — выходим
    if (!queue.pendingSnapshot || queue.isSaving) {
      return;
    }

    if (!isAuthenticated || typeof window === "undefined") {
      queue.pendingSnapshot = null;
      return;
    }

    const snapshot = queue.pendingSnapshot;
    queue.pendingSnapshot = null;
    queue.isSaving = true;

    const mutateFn = queue.activeMutate ?? mutate;
    const client = queue.activeQueryClient ?? queryClient;

    client
      .cancelQueries({
        queryKey: getProfileControllerGetDeviceSettingsQueryKey({
          clientId,
        }),
      })
      .catch(() => {});

    try {
      mutateFn(
        {
          data: {
            clientId: getClientDeviceId(),
            deviceName: getDeviceName(),
            audioVolume: snapshot.settings.audioVolume,
            speechVolume: snapshot.settings.speechVolume,
            micGain: snapshot.settings.micGain,
            preferredAudioInputLabel:
              snapshot.settings.preferredAudioInputLabel ?? null,
            preferredAudioOutputLabel:
              snapshot.settings.preferredAudioOutputLabel ?? null,
            preferredVideoInputLabel:
              snapshot.settings.preferredVideoInputLabel ?? null,
          },
        },
        {
          onSuccess: (savedData) => {
            queue.committedRevision = Math.max(
              queue.committedRevision,
              snapshot.revision,
            );
            // Согласовать кэш GET-запроса после успешного сохранения настроек на сервере (PUT)
            client.setQueryData(
              getProfileControllerGetDeviceSettingsQueryKey({ clientId }),
              savedData,
            );
          },
          onError: (err) => {
            console.warn(
              "[useMediaSettings] Failed to save media settings:",
              err,
            );
          },
          onSettled: () => {
            queue.isSaving = false;
            // После завершения предыдущей записи отправляем последний накопившийся снимок
            sendPendingSnapshot();
          },
        },
      );
    } catch (err) {
      queue.isSaving = false;
      console.warn("[useMediaSettings] Synchronous error in mutate:", err);
    }
  }, [clientId, isAuthenticated, mutate, queryClient, queue]);

  useEffect(() => {
    const prevUserId = prevUserIdRef.current;
    const prevClientId = prevClientIdRef.current;
    const prevIsAuthenticated = prevIsAuthenticatedRef.current;

    prevUserIdRef.current = userId;
    prevClientIdRef.current = clientId;
    prevIsAuthenticatedRef.current = isAuthenticated;

    // Переход userId от undefined к текущему пользователю при активной сессии
    // — это завершение начальной загрузки профиля, а не смена пользователя.
    const isInitialUserResolution =
      prevClientId === clientId &&
      prevIsAuthenticated === isAuthenticated &&
      isAuthenticated &&
      prevUserId === undefined &&
      userId !== undefined;

    if (isInitialUserResolution) {
      // Сохраняем начальную синхронизацию и запланированные снимки.
      // Если снимок был отложен и таймер не активен (например, уже истёк во время ожидания), отправляем его.
      if (
        queue.pendingSnapshot &&
        queue.syncTimeout === null &&
        !queue.isSaving
      ) {
        sendPendingSnapshot();
      }
      return;
    }

    // При реальной смене пользователя или выходе из системы сбрасываем очередь
    const isUserSwitch =
      (prevUserId !== undefined &&
        userId !== undefined &&
        prevUserId !== userId) ||
      (prevIsAuthenticated && !isAuthenticated);

    const isClientChange = prevClientId !== clientId;

    if (isUserSwitch || isClientChange) {
      if (queue.syncTimeout) {
        clearTimeout(queue.syncTimeout);
        queue.syncTimeout = null;
      }
      queue.initialSyncDone = false;
      queue.localRevision = 0;
      queue.committedRevision = 0;
      queue.isSaving = false;
      queue.pendingSnapshot = null;
    }
  }, [clientId, isAuthenticated, userId, queue, sendPendingSnapshot]);

  useEffect(() => {
    return () => {
      // При размонтировании не теряем запланированные изменения:
      // если таймер дебаунса ещё активен, отменяем ожидание и немедленно отправляем
      // накопленный снимок с учётом статуса сессии
      if (queue.syncTimeout) {
        clearTimeout(queue.syncTimeout);
        queue.syncTimeout = null;
      }
      if (
        isAuthenticated &&
        typeof window !== "undefined" &&
        queue.pendingSnapshot
      ) {
        sendPendingSnapshot();
      }
    };
  }, [isAuthenticated, queue, sendPendingSnapshot]);

  // Синхронизация локальных настроек с бэкендом (с дебаунсом и сериализацией)
  const syncToServer = useCallback(
    (toSave: MediaSettings, isLocalChange = true) => {
      if (!isAuthenticated || typeof window === "undefined") return;
      if (isLocalChange) queue.localRevision += 1;

      // Сохраняем самый свежий снимок настроек для отправки
      queue.pendingSnapshot = {
        settings: toSave,
        revision: queue.localRevision,
      };

      if (queue.syncTimeout) {
        clearTimeout(queue.syncTimeout);
      }

      queue.syncTimeout = setTimeout(() => {
        queue.syncTimeout = null;
        sendPendingSnapshot();
      }, 400);
    },
    [isAuthenticated, queue, sendPendingSnapshot],
  );

  // Подписка на глобальные изменения настроек
  useEffect(() => {
    const listener: Listener = (newSettings) => {
      setSettings(newSettings);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // При получении настроек с сервера для текущего устройства обновляем локальный стейт
  // biome-ignore lint/correctness/useExhaustiveDependencies: синхронизация локального стейта при получении serverSettings
  useEffect(() => {
    if (isFetchingServerSettings && !wasFetchingServerSettingsRef.current) {
      hydrationRevisionRef.current = queue.localRevision;
    }
    wasFetchingServerSettingsRef.current = isFetchingServerSettings;

    // Учитываем незавершённые локальные записи (отложенный дебаунс, выполняющийся PUT, накопившийся снимок в очереди или неподтверждённая ревизия)
    const hasPendingLocalWrites =
      queue.syncTimeout !== null ||
      queue.isSaving ||
      queue.pendingSnapshot !== null ||
      updateMutation.isPending ||
      queue.localRevision > queue.committedRevision;

    if (
      !serverSettings ||
      isFetchingServerSettings ||
      hasPendingLocalWrites ||
      queue.localRevision !== hydrationRevisionRef.current
    ) {
      return;
    }

    if (!serverSettings.isPersisted) {
      // На сервере ещё нет сохранённых настроек для этого устройства.
      // Не перезаписываем локальные настройки дефолтами, а отправляем текущие настройки на сервер.
      if (!queue.initialSyncDone) {
        queue.initialSyncDone = true;
        syncToServer(currentSettings, false);
      }
      return;
    }

    updateSettings((prev) => ({
      ...prev,
      audioVolume: serverSettings.audioVolume ?? prev.audioVolume,
      speechVolume: serverSettings.speechVolume ?? prev.speechVolume,
      micGain: serverSettings.micGain ?? prev.micGain,
      preferredAudioInputLabel:
        serverSettings.preferredAudioInputLabel ??
        prev.preferredAudioInputLabel ??
        null,
      preferredAudioOutputLabel:
        serverSettings.preferredAudioOutputLabel ??
        prev.preferredAudioOutputLabel ??
        null,
      preferredVideoInputLabel:
        serverSettings.preferredVideoInputLabel ??
        prev.preferredVideoInputLabel ??
        null,
    }));
  }, [
    isFetchingServerSettings,
    serverSettings,
    syncToServer,
    updateMutation.isPending,
  ]);

  // Проверка поддержки HTMLMediaElement.prototype.setSinkId
  const isSinkIdSupported =
    typeof window !== "undefined" &&
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype;

  // Перечисление устройств
  const refreshDevices = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.enumerateDevices
    ) {
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
      setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
      setVideoInputs(devices.filter((d) => d.kind === "videoinput"));
    } catch (err) {
      console.warn("[useMediaSettings] Failed to enumerate devices:", err);
    }
  }, []);

  // Автоподбор устройств по preferred label при изменении списка устройств
  useEffect(() => {
    if (audioInputs.length > 0) {
      const matched = matchDevice(
        audioInputs,
        settings.preferredAudioInputLabel,
        settings.audioInputId,
      );
      if (matched && matched !== settings.audioInputId) {
        updateSettings((prev) => ({ ...prev, audioInputId: matched }));
      }
    }
  }, [audioInputs, settings.preferredAudioInputLabel, settings.audioInputId]);

  useEffect(() => {
    if (audioOutputs.length > 0) {
      const matched = matchDevice(
        audioOutputs,
        settings.preferredAudioOutputLabel,
        settings.audioOutputId,
      );
      if (matched && matched !== settings.audioOutputId) {
        updateSettings((prev) => ({ ...prev, audioOutputId: matched }));
      }
    }
  }, [
    audioOutputs,
    settings.preferredAudioOutputLabel,
    settings.audioOutputId,
  ]);

  useEffect(() => {
    if (videoInputs.length > 0) {
      const matched = matchDevice(
        videoInputs,
        settings.preferredVideoInputLabel,
        settings.videoInputId,
      );
      if (matched && matched !== settings.videoInputId) {
        updateSettings((prev) => ({ ...prev, videoInputId: matched }));
      }
    }
  }, [videoInputs, settings.preferredVideoInputLabel, settings.videoInputId]);

  // Первоначальная загрузка и отслеживание подключения устройств
  useEffect(() => {
    void refreshDevices();

    if (
      typeof navigator !== "undefined" &&
      navigator.mediaDevices?.addEventListener
    ) {
      const handleDeviceChange = () => {
        void refreshDevices();
      };
      navigator.mediaDevices.addEventListener(
        "devicechange",
        handleDeviceChange,
      );
      return () => {
        navigator.mediaDevices.removeEventListener(
          "devicechange",
          handleDeviceChange,
        );
      };
    }
  }, [refreshDevices]);

  const setAudioInputId = useCallback(
    (id: string) => {
      const dev = audioInputs.find((d) => d.deviceId === id);
      updateSettings((prev) => {
        const next = {
          ...prev,
          audioInputId: id,
          preferredAudioInputLabel: dev?.label || prev.preferredAudioInputLabel,
        };
        syncToServer(next);
        return next;
      });
    },
    [audioInputs, syncToServer],
  );

  const setAudioOutputId = useCallback(
    (id: string) => {
      const dev = audioOutputs.find((d) => d.deviceId === id);
      updateSettings((prev) => {
        const next = {
          ...prev,
          audioOutputId: id,
          preferredAudioOutputLabel:
            dev?.label || prev.preferredAudioOutputLabel,
        };
        syncToServer(next);
        return next;
      });
    },
    [audioOutputs, syncToServer],
  );

  const setVideoInputId = useCallback(
    (id: string) => {
      const dev = videoInputs.find((d) => d.deviceId === id);
      updateSettings((prev) => {
        const next = {
          ...prev,
          videoInputId: id,
          preferredVideoInputLabel: dev?.label || prev.preferredVideoInputLabel,
        };
        syncToServer(next);
        return next;
      });
    },
    [videoInputs, syncToServer],
  );

  const setAudioVolume = useCallback(
    (vol: number) => {
      updateSettings((prev) => {
        const next = {
          ...prev,
          audioVolume: Math.max(0, Math.min(100, vol)),
        };
        syncToServer(next);
        return next;
      });
    },
    [syncToServer],
  );

  const setSpeechVolume = useCallback(
    (vol: number) => {
      updateSettings((prev) => {
        const next = {
          ...prev,
          speechVolume: Math.max(0, Math.min(100, vol)),
        };
        syncToServer(next);
        return next;
      });
    },
    [syncToServer],
  );

  const setMicGain = useCallback(
    (gain: number) => {
      updateSettings((prev) => {
        const next = {
          ...prev,
          micGain: Math.max(0, Math.min(100, gain)),
        };
        syncToServer(next);
        return next;
      });
    },
    [syncToServer],
  );

  const playTestSound = useCallback(() => {
    if (isPlayingTestSound) return;
    setIsPlayingTestSound(true);
    void playChimeSound(settings.audioVolume, settings.audioOutputId);
    setTimeout(() => {
      setIsPlayingTestSound(false);
    }, 700);
  }, [isPlayingTestSound, settings.audioVolume, settings.audioOutputId]);

  return {
    ...settings,
    audioInputs,
    audioOutputs,
    videoInputs,
    isSinkIdSupported,
    setAudioInputId,
    setAudioOutputId,
    setVideoInputId,
    setAudioVolume,
    setSpeechVolume,
    setMicGain,
    refreshDevices,
    playTestSound,
    isPlayingTestSound,
  };
}
