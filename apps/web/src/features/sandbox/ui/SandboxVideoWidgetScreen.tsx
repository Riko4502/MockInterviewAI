"use client";

import { AlertCircleIcon, MicIcon, UserIcon } from "@packages/icons";
import { useEffect, useRef } from "react";
import type { ConnectionState } from "../lib/useWebRTC";

interface SandboxVideoWidgetScreenProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: ConnectionState;
  isInCall: boolean;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  callError: string | null;
  peerName?: string;
  hasPeerOnline: boolean;
  localAudioLevel: number;
  remoteAudioLevel: number;
  onCopyInvite?: () => void;
  isInviteCopied?: boolean;
}

export function SandboxVideoWidgetScreen({
  localStream,
  remoteStream,
  connectionState,
  isInCall,
  isAudioMuted,
  isVideoOff,
  callError,
  peerName = "Собеседник",
  hasPeerOnline,
  localAudioLevel,
  remoteAudioLevel,
  onCopyInvite,
  isInviteCopied,
}: SandboxVideoWidgetScreenProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

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

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
      {callError && (
        <div className="flex size-full flex-col items-center justify-center p-4 text-center text-xs text-rose-400">
          <AlertCircleIcon className="mb-2 size-6" />
          <p>{callError}</p>
        </div>
      )}

      {!callError && (
        <>
          {/* Если есть удаленный поток — выводим его в центре */}
          {remoteStream ? (
            // biome-ignore lint/a11y/useMediaCaption: WebRTC realtime video stream
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="size-full object-cover"
            />
          ) : localStream ? (
            // Если собеседник еще не подключился, выводим локальную камеру на полный экран
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
                  : isInCall
                    ? `Ожидание видео от ${peerName}...`
                    : "Звонок не начат"}
              </span>
              {!isInCall && (
                <span className="mt-1 text-[11px] text-zinc-500">
                  Нажмите «Позвонить», чтобы связаться
                </span>
              )}
            </div>
          )}

          {/* Плавающее окно «Моя камера» (PIP в правом нижнем углу) когда удаленный стрим активен */}
          {remoteStream && localStream && (
            <div className="absolute right-2 bottom-2 z-10 h-24 w-32 overflow-hidden rounded-lg border border-border/80 bg-zinc-900 shadow-lg">
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
                <div className="flex size-full flex-col items-center justify-center bg-zinc-800 text-[10px] text-zinc-400">
                  <span>Камера выкл</span>
                </div>
              )}
              <span className="absolute bottom-1 left-1.5 rounded bg-black/60 px-1 py-0.2 text-[9px] text-white">
                Вы
              </span>
            </div>
          )}

          {/* Индикатор микрофона собеседника */}
          {remoteStream && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur-xs">
              <MicIcon className="size-3 text-muted-foreground" />
              <span className="text-[10px]">{peerName}</span>
              <div className="flex h-2.5 items-end gap-0.5">
                <div
                  className="w-1 rounded-xs bg-emerald-400 transition-all duration-75"
                  style={{ height: `${Math.max(20, remoteAudioLevel)}%` }}
                />
              </div>
            </div>
          )}

          {/* Индикатор моего микрофона */}
          {localStream && !isAudioMuted && (
            <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur-xs">
              <MicIcon className="size-3" />
              <span className="text-[10px]">Вы</span>
              <div
                className="size-2 rounded-full bg-emerald-400 transition-all"
                style={{
                  transform: `scale(${1 + (localAudioLevel / 100) * 0.5})`,
                  opacity: localAudioLevel > 5 ? 1 : 0.4,
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
