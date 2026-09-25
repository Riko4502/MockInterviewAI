"use client";

import {
  CameraIcon,
  CheckIcon,
  HeadphonesIcon,
  MicIcon,
  SlidersIcon,
  Volume1Icon,
  Volume2Icon,
  VolumeXIcon,
} from "@packages/icons";
import {
  Button,
  Dialog,
  Label,
  Progress,
  Select,
  Slider,
  Tabs,
} from "@packages/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { useMicLevelMeter } from "../lib/useMicLevelMeter";
import { useMediaSettings } from "../model/useMediaSettings";

export interface MediaSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAudioDeviceChange?: (deviceId: string) => void;
  onVideoDeviceChange?: (deviceId: string) => void;
  onAudioOutputChange?: (deviceId: string) => void;
}

export function MediaSettingsDialog({
  open,
  onOpenChange,
  onAudioDeviceChange,
  onVideoDeviceChange,
  onAudioOutputChange,
}: MediaSettingsDialogProps) {
  const { t } = useTranslation("interview");
  const media = useMediaSettings();
  const [activeTab, setActiveTab] = useState<string>("audio");
  const [isVideoPreviewActive, setIsVideoPreviewActive] =
    useState<boolean>(false);

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  // Живой индикатор уровня микрофона
  const { level: micLevel, error: micError } = useMicLevelMeter(
    media.audioInputId,
    open && activeTab === "audio",
    media.micGain,
  );

  // Обновление списка устройств при открытии диалога
  useEffect(() => {
    if (open) {
      void media.refreshDevices();
    }
  }, [open, media.refreshDevices]);

  // Управление предпросмотром камеры при открытии вкладки камеры
  useEffect(() => {
    if (!open || activeTab !== "video") {
      if (previewStreamRef.current) {
        for (const track of previewStreamRef.current.getTracks()) {
          track.stop();
        }
        previewStreamRef.current = null;
      }
      setIsVideoPreviewActive(false);
      return;
    }

    let isCancelled = false;

    const startCameraPreview = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: media.videoInputId
            ? { deviceId: { exact: media.videoInputId } }
            : true,
          audio: false,
        });

        if (isCancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }

        previewStreamRef.current = stream;
        setIsVideoPreviewActive(true);
        void media.refreshDevices();
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
          void previewVideoRef.current.play().catch(() => {});
        }
      } catch (err) {
        if (!isCancelled) {
          console.warn("[MediaSettingsDialog] Camera preview error:", err);
          setIsVideoPreviewActive(false);
        }
      }
    };

    void startCameraPreview();

    return () => {
      isCancelled = true;
      if (previewStreamRef.current) {
        for (const track of previewStreamRef.current.getTracks()) {
          track.stop();
        }
        previewStreamRef.current = null;
      }
      setIsVideoPreviewActive(false);
    };
  }, [open, activeTab, media.videoInputId, media.refreshDevices]);

  const handleAudioInputChange = (val: string) => {
    const nextVal = val === "default" ? "" : val;
    media.setAudioInputId(nextVal);
    onAudioDeviceChange?.(nextVal);
  };

  const handleAudioOutputChange = (val: string) => {
    const nextVal = val === "default" ? "" : val;
    media.setAudioOutputId(nextVal);
    onAudioOutputChange?.(nextVal);
  };

  const handleVideoInputChange = (val: string) => {
    const nextVal = val === "default" ? "" : val;
    media.setVideoInputId(nextVal);
    onVideoDeviceChange?.(nextVal);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-w-md sm:max-w-lg p-0 gap-0 overflow-hidden bg-background">
        <Dialog.Header className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <SlidersIcon className="size-5 text-emerald-500" />
            <Dialog.Title className="text-lg font-semibold">
              {t("sandbox.mediaSettings.title")}
            </Dialog.Title>
          </div>
          <Dialog.Description className="text-xs text-muted-foreground">
            {t("sandbox.mediaSettings.description")}
          </Dialog.Description>
        </Dialog.Header>

        <div className="p-6">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <Tabs.List className="grid w-full grid-cols-2 mb-6">
              <Tabs.Trigger value="audio" className="flex items-center gap-2">
                <Volume2Icon className="size-4" />
                <span>{t("sandbox.mediaSettings.tabAudio")}</span>
              </Tabs.Trigger>
              <Tabs.Trigger value="video" className="flex items-center gap-2">
                <CameraIcon className="size-4" />
                <span>{t("sandbox.mediaSettings.tabVideo")}</span>
              </Tabs.Trigger>
            </Tabs.List>

            {/* Вкладка: Звук, речь и микрофон */}
            <Tabs.Content
              value="audio"
              className="space-y-5 focus-visible:outline-hidden"
            >
              {/* 1. Устройство вывода (динамики / наушники) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5 text-xs font-medium">
                    <HeadphonesIcon className="size-3.5 text-muted-foreground" />
                    {t("sandbox.mediaSettings.outputDevice")}
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={media.playTestSound}
                    disabled={media.isPlayingTestSound}
                    className="h-7 px-2.5 text-xs gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Volume2Icon className="size-3 text-emerald-500" />
                    <span>
                      {media.isPlayingTestSound
                        ? t("sandbox.mediaSettings.testingSound")
                        : t("sandbox.mediaSettings.testSound")}
                    </span>
                  </Button>
                </div>

                <Select
                  value={media.audioOutputId || "default"}
                  onValueChange={handleAudioOutputChange}
                  disabled={
                    !media.isSinkIdSupported && media.audioOutputs.length === 0
                  }
                >
                  <Select.Trigger className="w-full h-9 text-xs">
                    <Select.Value
                      placeholder={t("sandbox.mediaSettings.defaultDevice")}
                    />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="default">
                      {t("sandbox.mediaSettings.defaultDevice")}
                    </Select.Item>
                    {media.audioOutputs
                      .filter(
                        (device) =>
                          device.deviceId && device.deviceId !== "default",
                      )
                      .map((device, idx) => (
                        <Select.Item
                          key={device.deviceId || `out-${idx}`}
                          value={device.deviceId}
                        >
                          {device.label ||
                            t("sandbox.mediaSettings.deviceSpeakerFallback", {
                              index: idx + 1,
                            })}
                        </Select.Item>
                      ))}
                  </Select.Content>
                </Select>
                {!media.isSinkIdSupported && (
                  <p className="text-[11px] text-muted-foreground italic">
                    {t("sandbox.mediaSettings.unsupportedSinkId")}
                  </p>
                )}
              </div>

              {/* 2. Громкость аудио (звонка / собеседника) */}
              <div className="space-y-1.5 rounded-lg border border-border/60 p-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="audio-volume-slider"
                    className="text-xs font-medium"
                  >
                    {t("sandbox.mediaSettings.audioVolume")}
                  </Label>
                  <span className="text-xs tabular-nums font-semibold text-emerald-500">
                    {media.audioVolume}%
                  </span>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  {media.audioVolume === 0 ? (
                    <VolumeXIcon className="size-4 text-rose-400 shrink-0" />
                  ) : media.audioVolume < 50 ? (
                    <Volume1Icon className="size-4 text-muted-foreground shrink-0" />
                  ) : (
                    <Volume2Icon className="size-4 text-emerald-500 shrink-0" />
                  )}
                  <Slider
                    id="audio-volume-slider"
                    value={[media.audioVolume]}
                    onValueChange={(vals) =>
                      media.setAudioVolume(vals[0] ?? 80)
                    }
                    min={0}
                    max={100}
                    step={1}
                    className="flex-1"
                    aria-label={t("sandbox.mediaSettings.audioVolume")}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t("sandbox.mediaSettings.audioVolumeDesc")}
                </p>
              </div>

              {/* 3. Громкость речи (озвучки / ассистента) */}
              <div className="space-y-1.5 rounded-lg border border-border/60 p-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="speech-volume-slider"
                    className="text-xs font-medium"
                  >
                    {t("sandbox.mediaSettings.speechVolume")}
                  </Label>
                  <span className="text-xs tabular-nums font-semibold text-indigo-400">
                    {media.speechVolume}%
                  </span>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <Volume2Icon className="size-4 text-indigo-400 shrink-0" />
                  <Slider
                    id="speech-volume-slider"
                    value={[media.speechVolume]}
                    onValueChange={(vals) =>
                      media.setSpeechVolume(vals[0] ?? 90)
                    }
                    min={0}
                    max={100}
                    step={1}
                    className="flex-1"
                    aria-label={t("sandbox.mediaSettings.speechVolume")}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t("sandbox.mediaSettings.speechVolumeDesc")}
                </p>
              </div>

              {/* 4. Устройство ввода (микрофон) */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-medium">
                  <MicIcon className="size-3.5 text-muted-foreground" />
                  {t("sandbox.mediaSettings.inputDevice")}
                </Label>
                <Select
                  value={media.audioInputId || "default"}
                  onValueChange={handleAudioInputChange}
                >
                  <Select.Trigger className="w-full h-9 text-xs">
                    <Select.Value
                      placeholder={t("sandbox.mediaSettings.defaultDevice")}
                    />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="default">
                      {t("sandbox.mediaSettings.defaultDevice")}
                    </Select.Item>
                    {media.audioInputs
                      .filter(
                        (device) =>
                          device.deviceId && device.deviceId !== "default",
                      )
                      .map((device, idx) => (
                        <Select.Item
                          key={device.deviceId || `in-${idx}`}
                          value={device.deviceId}
                        >
                          {device.label ||
                            t("sandbox.mediaSettings.deviceMicFallback", {
                              index: idx + 1,
                            })}
                        </Select.Item>
                      ))}
                  </Select.Content>
                </Select>
              </div>

              {/* 5. Чувствительность микрофона и живой уровень */}
              <div className="space-y-2 rounded-lg border border-border/60 p-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="mic-gain-slider"
                    className="text-xs font-medium"
                  >
                    {t("sandbox.mediaSettings.micGain")}
                  </Label>
                  <span className="text-xs tabular-nums font-semibold text-muted-foreground">
                    {media.micGain}%
                  </span>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <MicIcon className="size-4 text-emerald-500 shrink-0" />
                  <Slider
                    id="mic-gain-slider"
                    value={[media.micGain]}
                    onValueChange={(vals) => media.setMicGain(vals[0] ?? 100)}
                    min={0}
                    max={100}
                    step={1}
                    className="flex-1"
                    aria-label={t("sandbox.mediaSettings.micGain")}
                  />
                </div>

                {/* Живой индикатор микрофона */}
                <div className="pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                    <span>{t("sandbox.mediaSettings.micLevel")}</span>
                    <span className="tabular-nums font-mono">{micLevel}%</span>
                  </div>
                  <Progress value={micLevel} className="h-1.5" />
                  {micError && (
                    <span className="text-[11px] text-rose-400 mt-1 block">
                      {t("sandbox.mediaSettings.micAccessDenied")}
                    </span>
                  )}
                </div>
              </div>
            </Tabs.Content>

            {/* Вкладка: Камера */}
            <Tabs.Content
              value="video"
              className="space-y-4 focus-visible:outline-hidden"
            >
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-medium">
                  <CameraIcon className="size-3.5 text-muted-foreground" />
                  {t("sandbox.mediaSettings.videoDevice")}
                </Label>
                <Select
                  value={media.videoInputId || "default"}
                  onValueChange={handleVideoInputChange}
                >
                  <Select.Trigger className="w-full h-9 text-xs">
                    <Select.Value
                      placeholder={t("sandbox.mediaSettings.defaultDevice")}
                    />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="default">
                      {t("sandbox.mediaSettings.defaultDevice")}
                    </Select.Item>
                    {media.videoInputs
                      .filter(
                        (device) =>
                          device.deviceId && device.deviceId !== "default",
                      )
                      .map((device, idx) => (
                        <Select.Item
                          key={device.deviceId || `cam-${idx}`}
                          value={device.deviceId}
                        >
                          {device.label ||
                            t("sandbox.mediaSettings.deviceCameraFallback", {
                              index: idx + 1,
                            })}
                        </Select.Item>
                      ))}
                  </Select.Content>
                </Select>
              </div>

              {/* Окно предпросмотра камеры */}
              <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-border/80 bg-zinc-950 flex items-center justify-center">
                <video
                  ref={previewVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`size-full object-cover -scale-x-100 ${
                    isVideoPreviewActive ? "block" : "hidden"
                  }`}
                />
                {!isVideoPreviewActive && (
                  <div className="flex flex-col items-center gap-2 text-zinc-500 text-xs">
                    <CameraIcon className="size-8 stroke-1 text-zinc-600" />
                    <span>{t("sandbox.mediaSettings.cameraOff")}</span>
                  </div>
                )}
              </div>
            </Tabs.Content>
          </Tabs>
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-border/60 bg-muted/10">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 gap-1.5 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
          >
            <CheckIcon className="size-3.5" />
            <span>{t("sandbox.mediaSettings.save")}</span>
          </Button>
        </div>
      </Dialog.Content>
    </Dialog>
  );
}
