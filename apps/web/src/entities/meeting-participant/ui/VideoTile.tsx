"use client";

import { MicIcon } from "@packages/icons";
import { Avatar, Badge } from "@packages/ui";
import { cn } from "@packages/utils";
import { useEffect, useMemo, useRef } from "react";
import type {
  MeetingParticipantState,
  MeetingReactionItem,
} from "../model/types";

/** Пропсы плитки участника встречи */
export interface VideoTileProps {
  /** Состояние участника (треки, микрофон, камера, спикер) */
  participant: MeetingParticipantState;
  /** Всплывающие эмодзи-реакции */
  reactions?: MeetingReactionItem[];
  /** Стили контейнера */
  className?: string;
  /** Зеркалировать локальное видео (по умолчанию true) */
  mirrorLocalVideo?: boolean;
}

/** Извлекает 1-2 инициала для аватара при выключенной камере */
function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Иконка выключенного микрофона (перечеркнутый микрофон) */
function MicOffIcon({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className,
      )}
    >
      <MicIcon size="sm" className="opacity-70" />
      <span
        aria-hidden="true"
        className="absolute h-0.5 w-3.5 -rotate-45 rounded-full bg-destructive-foreground shadow-xs"
      />
    </div>
  );
}

/**
 * Плитка участника видеозвонка.
 *
 * Отображает видеопоток WebRTC (или аватар с инициалами), статус микрофона,
 * бейдж руки, всплывающие эмодзи и подсветку активного спикера.
 */
export function VideoTile({
  participant,
  reactions = [],
  className,
  mirrorLocalVideo = true,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const hasVideoTrack = Boolean(participant.videoTrack?.track);
  const isVideoVisible = participant.isCameraEnabled && hasVideoTrack;
  const isMirrored = participant.isLocal && mirrorLocalVideo;

  const participantReactions = useMemo(() => {
    return reactions.filter(
      (r) =>
        r.participantId === participant.id ||
        (participant.identity && r.participantId === participant.identity),
    );
  }, [reactions, participant.id, participant.identity]);

  // Подключение видеотрека вебкамеры к тегу <video>
  useEffect(() => {
    const videoEl = videoRef.current;
    const track = participant.videoTrack?.track;

    if (!videoEl || !track || !isVideoVisible) return;

    track.attach(videoEl);

    return () => {
      track.detach(videoEl);
    };
  }, [participant.videoTrack?.track, isVideoVisible]);

  // Подключение аудиотрека собеседника (локальный игнорируем во избежание эха)
  useEffect(() => {
    const audioEl = audioRef.current;
    const track = participant.audioTrack?.track;

    if (!audioEl || !track || participant.isLocal) return;

    track.attach(audioEl);

    return () => {
      track.detach(audioEl);
    };
  }, [participant.audioTrack?.track, participant.isLocal]);

  return (
    <div
      data-slot="video-tile"
      data-participant-id={participant.id}
      data-is-local={participant.isLocal}
      data-is-speaking={participant.isSpeaking}
      className={cn(
        "group relative flex size-full items-center justify-center overflow-hidden rounded-2xl bg-card transition-all duration-300",
        "border border-border/80 shadow-xs",
        participant.isSpeaking &&
          "border-primary ring-2 ring-primary/60 shadow-[0_0_20px_rgba(var(--primary),0.25)]",
        className,
      )}
    >
      {/* Аудио удаленного участника */}
      {!participant.isLocal && (
        /* biome-ignore lint/a11y/useMediaCaption: WebRTC realtime audio stream */
        <audio ref={audioRef} autoPlay playsInline data-slot="remote-audio" />
      )}

      {/* Видео вебкамеры */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={participant.isLocal}
        data-slot="camera-video"
        className={cn(
          "size-full object-cover transition-opacity duration-300",
          isMirrored && "-scale-x-100",
          !isVideoVisible && "hidden",
        )}
      />

      {/* Заглушка, если камера выключена */}
      {!isVideoVisible && (
        <div
          data-slot="camera-placeholder"
          className="relative flex size-full flex-col items-center justify-center bg-gradient-to-b from-muted/50 via-card to-background p-4"
        >
          <Avatar
            size="lg"
            className="size-20 border-2 border-border shadow-md ring-4 ring-background/60"
          >
            <Avatar.Fallback className="bg-primary/10 text-primary text-xl font-semibold tracking-wider">
              {getInitials(participant.name)}
            </Avatar.Fallback>
          </Avatar>
        </div>
      )}

      {/* Индикатор поднятой руки */}
      {participant.isHandRaised && (
        <output
          data-slot="hand-raised-badge"
          aria-label="Рука поднята"
          className="absolute top-3 right-3 z-20 flex animate-bounce items-center gap-1 rounded-full bg-amber-500/95 px-2.5 py-1 text-xs font-semibold text-white shadow-lg backdrop-blur-md"
        >
          <span className="text-sm">✋</span>
          <span>Рука</span>
        </output>
      )}

      {/* Всплывающие эмодзи */}
      {participantReactions.length > 0 && (
        <div
          data-slot="floating-reactions"
          className="pointer-events-none absolute inset-x-0 bottom-14 z-30 flex flex-col items-center gap-1"
        >
          {participantReactions.map((reaction) => (
            <div
              key={reaction.id}
              className="animate-in fade-in slide-in-from-bottom-4 duration-300 flex items-center justify-center rounded-full bg-background/80 px-2 py-0.5 text-2xl shadow-lg backdrop-blur-md"
            >
              {reaction.emoji}
            </div>
          ))}
        </div>
      )}

      {/* Информационная плашка: имя, статус микрофона, роль */}
      <div
        data-slot="participant-info-bar"
        className="absolute inset-x-2 bottom-2 z-20 flex items-center justify-between pointer-events-none"
      >
        <div className="flex max-w-[85%] items-center gap-1.5 rounded-lg bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-md border border-border/40 pointer-events-auto">
          {!participant.isMicrophoneEnabled ? (
            <output
              aria-label="Микрофон выключен"
              className="flex size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-2xs"
            >
              <MicOffIcon className="size-3" />
            </output>
          ) : (
            <output
              aria-label="Микрофон включен"
              className={cn(
                "size-2 rounded-full transition-colors",
                participant.isSpeaking
                  ? "bg-emerald-500 animate-pulse ring-2 ring-emerald-500/40"
                  : "bg-muted-foreground/40",
              )}
            />
          )}

          <span
            className="truncate max-w-[140px] sm:max-w-[200px]"
            title={participant.name}
          >
            {participant.name}
          </span>

          {participant.isLocal && (
            <span className="text-muted-foreground font-normal">(Вы)</span>
          )}

          {participant.role === "HOST" && (
            <Badge
              variant="outline"
              className="h-4 px-1 text-[10px] uppercase tracking-wide border-primary/50 text-primary"
            >
              Хост
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
