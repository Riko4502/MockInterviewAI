"use client";

import { CameraIcon, HeadphonesIcon, MicIcon } from "@packages/icons";
import { Button, Dialog, Label, Select } from "@packages/ui";
import { useCallback, useEffect, useState } from "react";

/** Пропсы диалога настроек аудио и видеоустройств */
export interface DeviceSettingsDialogProps {
  /** Открыт ли диалог */
  open: boolean;
  /** Обработчик изменения видимости */
  onOpenChange: (open: boolean) => void;
  /** Текущий ID микрофона */
  currentAudioInputId?: string;
  /** Текущий ID камеры */
  currentVideoInputId?: string;
  /** Текущий ID аудиовыхода (динамиков) */
  currentAudioOutputId?: string;
  /** Callback при выборе микрофона */
  onAudioInputSelect?: (deviceId: string) => void;
  /** Callback при выборе камеры */
  onVideoInputSelect?: (deviceId: string) => void;
  /** Callback при выборе динамиков */
  onAudioOutputSelect?: (deviceId: string) => void;
}

/**
 * Диалог выбора медиаустройств в звонке.
 * Позволяет переключать физические микрофоны, вебкамеры и аудиовыходы на лету.
 */
export function DeviceSettingsDialog({
  open,
  onOpenChange,
  currentAudioInputId,
  currentVideoInputId,
  currentAudioOutputId,
  onAudioInputSelect,
  onVideoInputSelect,
  onAudioOutputSelect,
}: DeviceSettingsDialogProps) {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);

  const [selectedAudio, setSelectedAudio] = useState<string>(
    currentAudioInputId || "",
  );
  const [selectedVideo, setSelectedVideo] = useState<string>(
    currentVideoInputId || "",
  );
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>(
    currentAudioOutputId || "",
  );

  useEffect(() => {
    if (currentAudioInputId) setSelectedAudio(currentAudioInputId);
  }, [currentAudioInputId]);

  useEffect(() => {
    if (currentVideoInputId) setSelectedVideo(currentVideoInputId);
  }, [currentVideoInputId]);

  useEffect(() => {
    if (currentAudioOutputId) setSelectedSpeaker(currentAudioOutputId);
  }, [currentAudioOutputId]);

  const loadDevices = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.enumerateDevices
    ) {
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
      setVideoInputs(devices.filter((d) => d.kind === "videoinput"));
      setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
    } catch {
      // Игнорируем ошибки доступа к устройствам при перечислении
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    loadDevices();

    navigator.mediaDevices?.addEventListener("devicechange", loadDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", loadDevices);
    };
  }, [open, loadDevices]);

  const micOptions = audioInputs.map((d, index) => ({
    value: d.deviceId,
    label: d.label || `Микрофон ${index + 1}`,
  }));

  const cameraOptions = videoInputs.map((d, index) => ({
    value: d.deviceId,
    label: d.label || `Камера ${index + 1}`,
  }));

  const speakerOptions = audioOutputs.map((d, index) => ({
    value: d.deviceId,
    label: d.label || `Динамики ${index + 1}`,
  }));

  const handleAudioChange = (val: string) => {
    setSelectedAudio(val);
    onAudioInputSelect?.(val);
  };

  const handleVideoChange = (val: string) => {
    setSelectedVideo(val);
    onVideoInputSelect?.(val);
  };

  const handleSpeakerChange = (val: string) => {
    setSelectedSpeaker(val);
    onAudioOutputSelect?.(val);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-w-md w-[calc(100vw-2rem)] overflow-hidden">
        <Dialog.Header>
          <Dialog.Title>Настройки устройств</Dialog.Title>
          <Dialog.Description>
            Выберите оборудование для ввода и вывода звука и видео.
          </Dialog.Description>
        </Dialog.Header>

        <div className="space-y-4 py-2 w-full overflow-hidden">
          {/* Микрофон */}
          <div className="space-y-1.5 w-full overflow-hidden">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <MicIcon size="sm" className="text-muted-foreground" />
              <span>Микрофон</span>
            </Label>
            {micOptions.length > 0 ? (
              <Select
                value={selectedAudio || micOptions[0]?.value}
                onValueChange={handleAudioChange}
                options={micOptions}
                placeholder="Выберите микрофон"
                triggerClassName="w-full max-w-full justify-between truncate"
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Микрофоны не обнаружены
              </p>
            )}
          </div>

          {/* Камера */}
          <div className="space-y-1.5 w-full overflow-hidden">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <CameraIcon size="sm" className="text-muted-foreground" />
              <span>Камера</span>
            </Label>
            {cameraOptions.length > 0 ? (
              <Select
                value={selectedVideo || cameraOptions[0]?.value}
                onValueChange={handleVideoChange}
                options={cameraOptions}
                placeholder="Выберите камеру"
                triggerClassName="w-full max-w-full justify-between truncate"
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Камеры не обнаружены
              </p>
            )}
          </div>

          {/* Динамики / Аудиовыход (если поддерживается браузером) */}
          {speakerOptions.length > 0 && (
            <div className="space-y-1.5 w-full overflow-hidden">
              <Label className="flex items-center gap-1.5 text-xs font-medium">
                <HeadphonesIcon size="sm" className="text-muted-foreground" />
                <span>Динамики</span>
              </Label>
              <Select
                value={selectedSpeaker || speakerOptions[0]?.value}
                onValueChange={handleSpeakerChange}
                options={speakerOptions}
                placeholder="Выберите динамики"
                triggerClassName="w-full max-w-full justify-between truncate"
              />
            </div>
          )}
        </div>

        <Dialog.Footer className="mt-3 flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Готово</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
