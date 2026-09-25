"use client";

import { AlertCircleIcon, MicIcon, PlayIcon, UserIcon } from "@packages/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { useAudioVolumeMeter } from "../lib/useAudioVolumeMeter";
import { useSandboxMedia } from "../model/SandboxMediaContext";

export function SandboxVideoWidgetScreen() {
  const { t } = useTranslation("interview");
  const {
    localStream,
    remoteStream,
    connectionState,
    isInCall,
    isAudioMuted,
    isVideoOff,
    isRemoteVideoOff,
    isRemoteAudioMuted,
    callError,
    peerName,
    hasPeerOnline,
    onCopyInvite,
    isInviteCopied,
    audioVolume,
    selectedAudioOutputId,
  } = useSandboxMedia();

  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Синхронизация громкости с аудиоэлементом собеседника
  useEffect(() => {
    if (audioElementRef.current) {
      audioElementRef.current.volume =
        Math.max(0, Math.min(100, audioVolume ?? 80)) / 100;
    }
  }, [audioVolume]);

  // Применение выбранного устройства вывода (динамики / наушники)
  useEffect(() => {
    const el = audioElementRef.current;
    if (
      el &&
      selectedAudioOutputId &&
      typeof (el as unknown as { setSinkId?: (id: string) => Promise<void> })
        .setSinkId === "function"
    ) {
      void (el as unknown as { setSinkId: (id: string) => Promise<void> })
        .setSinkId(selectedAudioOutputId)
        .catch((err) => {
          console.warn(
            "[SandboxVideoWidgetScreen] Failed to set sinkId on remote audio element:",
            err,
          );
        });
    }
  }, [selectedAudioOutputId]);

  const localAudioLevel = useAudioVolumeMeter(localStream, isAudioMuted);
  const remoteAudioLevel = useAudioVolumeMeter(
    remoteStream,
    isRemoteAudioMuted,
  );

  const attemptPlayAudio = useCallback((el: HTMLAudioElement) => {
    const playPromise = el.play?.();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsAutoplayBlocked(false);
        })
        .catch((err: unknown) => {
          console.warn(
            "[SandboxVideoWidgetScreen] Remote audio autoplay blocked by browser policy:",
            err,
          );
          setIsAutoplayBlocked(true);
        });
    }
  }, []);

  const localVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      if (el) {
        el.srcObject = localStream ?? null;
        if (localStream) {
          el.play?.().catch(() => {});
        }
      }
    },
    [localStream],
  );

  const remoteVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      if (el) {
        el.srcObject = remoteStream ?? null;
        if (remoteStream) {
          el.play?.().catch(() => {});
        }
      }
    },
    [remoteStream],
  );

  const remoteAudioRef = useCallback(
    (el: HTMLAudioElement | null) => {
      audioElementRef.current = el;
      if (el && remoteStream && isInCall && el.srcObject !== remoteStream) {
        el.srcObject = remoteStream;
        attemptPlayAudio(el);
      }
    },
    [remoteStream, isInCall, attemptPlayAudio],
  );

  useEffect(() => {
    if (!isInCall || !remoteStream) {
      setIsAutoplayBlocked(false);
      return;
    }

    const el = audioElementRef.current;
    if (el && el.srcObject !== remoteStream) {
      el.srcObject = remoteStream;
      attemptPlayAudio(el);
    }
  }, [isInCall, remoteStream, attemptPlayAudio]);

  const handleResumeAutoplay = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current
        .play?.()
        .then(() => {
          setIsAutoplayBlocked(false);
        })
        .catch((err: unknown) => {
          console.error(
            "[SandboxVideoWidgetScreen] Failed to resume audio on user click:",
            err,
          );
        });
    }
  }, []);

  useEffect(() => {
    if (callError) {
      console.error(
        "[SandboxVideoWidgetScreen] Call error occurred:",
        callError,
      );
    }
  }, [callError]);

  const localizedCallError = callError
    ? t("sandbox.videoWidget.screen.callError")
    : null;

  const showRemoteVideo = isInCall && remoteStream && !isRemoteVideoOff;

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
      {/* Скрытый тег для непрерывного воспроизведения звука собеседника вне зависимости от включенной камеры */}
      {/* biome-ignore lint/a11y/useMediaCaption: WebRTC realtime audio stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Кнопка восстановления звука при блокировке autoplay браузером */}
      {isInCall && isAutoplayBlocked && (
        <div className="absolute inset-x-0 top-3 z-30 flex items-center justify-center px-4">
          <button
            type="button"
            onClick={handleResumeAutoplay}
            data-testid="unmute-autoplay-button"
            className="flex items-center gap-2 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3.5 py-1.5 text-xs font-semibold shadow-lg shadow-amber-500/20 backdrop-blur-md transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer"
          >
            <PlayIcon className="size-3.5 fill-current" />
            <span>{t("sandbox.videoWidget.screen.unmuteAutoplay")}</span>
          </button>
        </div>
      )}
      {callError && (
        <div className="flex size-full flex-col items-center justify-center p-4 text-center text-xs text-rose-400">
          <AlertCircleIcon className="mb-2 size-6" />
          <p>{localizedCallError}</p>
        </div>
      )}

      {!callError && (
        <>
          {/* Основной экран: Видео собеседника или аватар */}
          {showRemoteVideo ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted
              className="size-full object-cover"
            />
          ) : isInCall ? (
            <div className="flex size-full flex-col items-center justify-center bg-zinc-900 text-muted-foreground">
              <div className="relative flex size-16 items-center justify-center rounded-full bg-zinc-800 border border-border/40 shadow-inner">
                <UserIcon className="size-8 text-zinc-400" />
                <div
                  className={`absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-zinc-900 ${
                    isRemoteAudioMuted ? "bg-rose-500" : "bg-emerald-500"
                  }`}
                  title={
                    isRemoteAudioMuted
                      ? t("sandbox.videoWidget.screen.micMutedTooltip")
                      : t("sandbox.videoWidget.screen.micActiveTooltip")
                  }
                />
              </div>
              <span className="mt-2.5 text-xs font-semibold text-zinc-200">
                {peerName}
              </span>
              <span className="mt-0.5 text-[11px] text-zinc-400">
                {connectionState === "calling"
                  ? t("sandbox.videoWidget.screen.connecting")
                  : t("sandbox.videoWidget.screen.cameraOff")}
              </span>
            </div>
          ) : localStream ? (
            // Если звонок не начат, но есть локальный поток (превью)
            <div className="relative size-full overflow-hidden bg-zinc-900">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`size-full object-cover -scale-x-100 ${
                  isVideoOff ? "hidden" : "block"
                }`}
              />
              {isVideoOff && (
                <div className="flex size-full flex-col items-center justify-center bg-zinc-900 text-muted-foreground">
                  <div className="flex size-14 items-center justify-center rounded-full bg-zinc-800 shadow-inner">
                    <UserIcon className="size-7 text-zinc-400" />
                  </div>
                  <span className="mt-2 text-xs">
                    {t("sandbox.videoWidget.screen.cameraOff")}
                  </span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 flex items-center gap-2">
                <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-white backdrop-blur-xs">
                  {t("sandbox.videoWidget.screen.waitingForPeer")}
                </span>
                {!hasPeerOnline && onCopyInvite && (
                  <button
                    type="button"
                    onClick={onCopyInvite}
                    className="rounded bg-emerald-600/90 hover:bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white transition-colors shadow-xs"
                  >
                    {isInviteCopied
                      ? t("sandbox.videoWidget.screen.linkCopied")
                      : t("sandbox.videoWidget.screen.inviteSecondTab")}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex size-full flex-col items-center justify-center bg-zinc-900/90 text-muted-foreground">
              <div className="flex size-14 items-center justify-center rounded-full bg-zinc-800 shadow-inner">
                <UserIcon className="size-7 text-zinc-400" />
              </div>
              <span className="mt-2.5 text-xs font-medium text-zinc-300">
                {connectionState === "calling"
                  ? t("sandbox.videoWidget.screen.connectingWithPeer")
                  : t("sandbox.videoWidget.screen.callNotStarted")}
              </span>
              <span className="mt-1 text-[11px] text-zinc-500">
                {t("sandbox.videoWidget.screen.clickCallToConnect")}
              </span>
            </div>
          )}

          {/* Плавающее окно «Моя камера» (PIP в правом нижнем углу) во время звонка */}
          {isInCall && (
            <div className="absolute right-2 bottom-2 z-10 h-24 w-32 overflow-hidden rounded-lg border border-border/80 bg-zinc-900 shadow-lg">
              {localStream && !isVideoOff ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="size-full object-cover -scale-x-100"
                />
              ) : (
                <div className="flex size-full flex-col items-center justify-center bg-zinc-800 text-[10px] text-zinc-400">
                  <UserIcon className="size-4 mb-0.5 text-zinc-500" />
                  <span>{t("sandbox.videoWidget.screen.cameraOffShort")}</span>
                </div>
              )}
              <span className="absolute bottom-1 left-1.5 rounded bg-black/60 px-1 py-0.2 text-[9px] text-white">
                {t("sandbox.videoWidget.screen.you")}
              </span>
            </div>
          )}

          {/* Индикатор микрофона собеседника */}
          {isInCall && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur-xs">
              <MicIcon
                className={`size-3 ${
                  isRemoteAudioMuted ? "text-rose-400" : "text-emerald-400"
                }`}
              />
              <span className="text-[10px]">{peerName}</span>
              {!isRemoteAudioMuted && (
                <div className="flex h-2.5 items-end gap-0.5">
                  <div
                    className="w-1 rounded-xs bg-emerald-400 transition-all duration-75"
                    style={{ height: `${Math.max(20, remoteAudioLevel)}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Индикатор моего микрофона */}
          {isInCall && (
            <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur-xs">
              <MicIcon
                className={`size-3 ${
                  isAudioMuted ? "text-rose-400" : "text-emerald-400"
                }`}
              />
              <span className="text-[10px]">
                {t("sandbox.videoWidget.screen.you")}
              </span>
              {!isAudioMuted && (
                <div
                  className="size-2 rounded-full bg-emerald-400 transition-all"
                  style={{
                    transform: `scale(${1 + (localAudioLevel / 100) * 0.5})`,
                    opacity: localAudioLevel > 5 ? 1 : 0.4,
                  }}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
