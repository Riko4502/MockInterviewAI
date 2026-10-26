"use client";

import { ScreenIcon } from "@packages/icons";
import { Button } from "@packages/ui";
import { cn } from "@packages/utils";
import { useEffect, useRef } from "react";
import {
  type MeetingParticipantState,
  type MeetingReactionItem,
  VideoTile,
} from "@/entities/meeting-participant";

/** Пропсы сцены демонстрации экрана */
export interface ScreenShareStageProps {
  /** Участник, который сейчас демонстрирует экран */
  screenShareParticipant: MeetingParticipantState;
  /** Список всех участников встречи для отображения в боковой полосе */
  allParticipants: MeetingParticipantState[];
  /** Всплывающие эмодзи-реакции */
  reactions?: MeetingReactionItem[];
  /** Callback остановки шаринга (для локального пользователя) */
  onStopScreenShare?: () => void;
  /** Дополнительные CSS классы */
  className?: string;
}

/**
 * Сцена демонстрации экрана в режиме Spotlight (ScreenShareStage).
 *
 * Отводит до 80% пространства под видеотрек экрана высокой четкости,
 * а видео участников располагает в вертикальной или горизонтальной ленте.
 */
export function ScreenShareStage({
  screenShareParticipant,
  allParticipants,
  reactions = [],
  onStopScreenShare,
  className,
}: ScreenShareStageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Аттач видеотрека демонстрации экрана
  useEffect(() => {
    const videoEl = videoRef.current;
    const track = screenShareParticipant.screenShareTrack?.track;

    if (!videoEl || !track) return;

    track.attach(videoEl);

    return () => {
      track.detach(videoEl);
    };
  }, [screenShareParticipant.screenShareTrack?.track]);

  return (
    <div
      data-slot="screen-share-stage"
      className={cn(
        "flex size-full flex-col lg:flex-row gap-3 p-3 md:gap-4 md:p-4 overflow-hidden",
        className,
      )}
    >
      {/* Главная сцена: Демонстрация экрана */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-border bg-black/90 shadow-2xl">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          data-slot="screen-share-video"
          className="size-full object-contain"
        />

        {/* Верхняя плашка с информацией о демонстрации */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-xl bg-background/85 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-md border border-border/50 shadow-md">
          <ScreenIcon size="sm" className="text-primary" />
          <span>
            {screenShareParticipant.isLocal ? (
              <span className="text-primary font-semibold">
                Вы демонстрируете экран
              </span>
            ) : (
              <span>
                Демонстрация: <strong>{screenShareParticipant.name}</strong>
              </span>
            )}
          </span>

          {screenShareParticipant.isLocal && onStopScreenShare && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onStopScreenShare}
              className="ml-2 h-6 px-2 text-[11px]"
            >
              Остановить
            </Button>
          )}
        </div>
      </div>

      {/* Боковая/нижняя лента видео участников звонка */}
      <div className="flex shrink-0 lg:w-64 xl:w-72 flex-row lg:flex-col gap-2.5 overflow-x-auto lg:overflow-y-auto lg:overflow-x-hidden py-1">
        {allParticipants.map((participant) => (
          <div
            key={participant.id}
            className="aspect-video w-44 shrink-0 lg:w-full min-h-[110px]"
          >
            <VideoTile
              participant={participant}
              reactions={reactions}
              className="size-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
