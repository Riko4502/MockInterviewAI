"use client";

import {
  useProfileControllerGetDeviceSettings,
  useProfileControllerUpdateDeviceSettings,
} from "@packages/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/entities/session";
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

export function useMediaSettings(): MediaSettingsContextValue {
  const session = useSession({ optional: true });
  const isAuthenticated = session?.isAuthenticated ?? false;

  const [settings, setSettings] = useState<MediaSettings>(currentSettings);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);

  const clientId =
    typeof window !== "undefined" ? getClientDeviceId() : "client-init";

  const { data: serverSettings } = useProfileControllerGetDeviceSettings(
    { clientId },
    {
      query: {
        enabled: isAuthenticated && typeof window !== "undefined",
      },
    },
  );

  const updateMutation = useProfileControllerUpdateDeviceSettings();
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Синхронизация локальных настроек с бэкендом (с дебаунсом)
  const syncToServer = useCallback(
    (toSave: MediaSettings) => {
      if (!isAuthenticated || typeof window === "undefined") return;

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = setTimeout(() => {
        updateMutation.mutate({
          data: {
            clientId: getClientDeviceId(),
            deviceName: getDeviceName(),
            audioVolume: toSave.audioVolume,
            speechVolume: toSave.speechVolume,
            micGain: toSave.micGain,
            preferredAudioInputLabel: toSave.preferredAudioInputLabel ?? null,
            preferredAudioOutputLabel: toSave.preferredAudioOutputLabel ?? null,
            preferredVideoInputLabel: toSave.preferredVideoInputLabel ?? null,
          },
        });
      }, 400);
    },
    [isAuthenticated, updateMutation],
  );

  // При получении настроек с сервера для текущего устройства обновляем локальный стейт
  useEffect(() => {
    if (!serverSettings) return;

    if (!serverSettings.isPersisted) {
      // На сервере ещё нет сохранённых настроек для этого устройства.
      // Не перезаписываем локальные настройки дефолтами, а отправляем текущие настройки на сервер.
      syncToServer(currentSettings);
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
  }, [serverSettings, syncToServer]);

  // Проверка поддержки HTMLMediaElement.prototype.setSinkId
  const isSinkIdSupported =
    typeof window !== "undefined" &&
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype;

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
