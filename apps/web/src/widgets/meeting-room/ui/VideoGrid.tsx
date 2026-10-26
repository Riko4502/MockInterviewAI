"use client";

import { cn } from "@packages/utils";
import {
  type MeetingParticipantState,
  type MeetingReactionItem,
  VideoTile,
} from "@/entities/meeting-participant";

/** Пропсы адаптивной сетки участников */
export interface VideoGridProps {
  /** Список участников звонка */
  participants: MeetingParticipantState[];
  /** Всплывающие эмодзи-реакции */
  reactions?: MeetingReactionItem[];
  /** Дополнительные CSS классы контейнера сетки */
  className?: string;
}

/** Вычисляет оптимальные CSS классы сетки в зависимости от числа участников */
function getGridClasses(count: number): string {
  if (count <= 1) {
    return "grid-cols-1 max-w-4xl";
  }
  if (count === 2) {
    return "grid-cols-1 md:grid-cols-2 max-w-5xl";
  }
  if (count <= 4) {
    return "grid-cols-1 sm:grid-cols-2 max-w-6xl";
  }
  if (count <= 6) {
    return "grid-cols-2 md:grid-cols-3 max-w-7xl";
  }
  return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-w-7xl";
}

/**
 * Адаптивная CSS-сетка участников видеовстречи (VideoGrid).
 *
 * Автоматически рассчитывает размеры и количество колонок для 1-12 участников,
 * масштабируя плитки VideoTile под доступную область экрана.
 */
export function VideoGrid({
  participants,
  reactions = [],
  className,
}: VideoGridProps) {
  if (participants.length === 0) {
    return (
      <div className="flex size-full items-center justify-center p-8 text-center text-muted-foreground">
        <p className="text-sm">В комнате пока нет участников</p>
      </div>
    );
  }

  const gridClasses = getGridClasses(participants.length);

  return (
    <div
      data-slot="meeting-video-grid"
      className={cn(
        "grid size-full auto-rows-fr gap-3 p-3 md:gap-4 md:p-4 place-content-center mx-auto transition-all duration-300",
        gridClasses,
        className,
      )}
    >
      {participants.map((participant) => (
        <div
          key={participant.id}
          className="relative flex aspect-video size-full items-center justify-center min-h-[160px]"
        >
          <VideoTile
            participant={participant}
            reactions={reactions}
            className="size-full"
          />
        </div>
      ))}
    </div>
  );
}
