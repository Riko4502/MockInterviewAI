import { AlertCircleIcon, MicIcon, UserIcon } from "@packages/icons";
import { useEffect, useRef } from "react";
import { useAudioVolumeMeter } from "../lib/useAudioVolumeMeter";
import { useSandboxMedia } from "../model/SandboxMediaContext";

export function SandboxVideoWidgetScreen() {
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
  } = useSandboxMedia();

  const localAudioLevel = useAudioVolumeMeter(localStream, isAudioMuted);
  const remoteAudioLevel = useAudioVolumeMeter(
    remoteStream,
    isRemoteAudioMuted,
  );
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play?.().catch(() => {});
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play?.().catch(() => {});
    }
  }, [remoteStream]);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play?.().catch(() => {});
    }
  }, [remoteStream]);

  const showRemoteVideo = isInCall && remoteStream && !isRemoteVideoOff;

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
      {/* Скрытый тег для непрерывного воспроизведения звука собеседника вне зависимости от включенной камеры */}
      {/* biome-ignore lint/a11y/useMediaCaption: WebRTC realtime audio stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      {callError && (
        <div className="flex size-full flex-col items-center justify-center p-4 text-center text-xs text-rose-400">
          <AlertCircleIcon className="mb-2 size-6" />
          <p>{callError}</p>
        </div>
      )}

      {!callError && (
        <>
          {/* Основной экран: Видео собеседника или аватар */}
          {showRemoteVideo ? (
            // biome-ignore lint/a11y/useMediaCaption: WebRTC realtime video stream
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
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
                      ? "Микрофон выключен"
                      : "Микрофон активен"
                  }
                />
              </div>
              <span className="mt-2.5 text-xs font-semibold text-zinc-200">
                {peerName}
              </span>
              <span className="mt-0.5 text-[11px] text-zinc-400">
                {connectionState === "calling"
                  ? "Соединение..."
                  : "Камера выключена"}
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
                  <span className="mt-2 text-xs">Камера выключена</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 flex items-center gap-2">
                <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-white backdrop-blur-xs">
                  Вы • Ожидание собеседника
                </span>
                {!hasPeerOnline && onCopyInvite && (
                  <button
                    type="button"
                    onClick={onCopyInvite}
                    className="rounded bg-emerald-600/90 hover:bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white transition-colors shadow-xs"
                  >
                    {isInviteCopied
                      ? "Ссылка скопирована! ✓"
                      : "📋 Пригласить во 2-ю вкладку"}
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
                  ? "Соединение с собеседником..."
                  : "Звонок не начат"}
              </span>
              <span className="mt-1 text-[11px] text-zinc-500">
                Нажмите «Позвонить», чтобы связаться
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
                  <span>Камера выкл</span>
                </div>
              )}
              <span className="absolute bottom-1 left-1.5 rounded bg-black/60 px-1 py-0.2 text-[9px] text-white">
                Вы
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
              <span className="text-[10px]">Вы</span>
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
