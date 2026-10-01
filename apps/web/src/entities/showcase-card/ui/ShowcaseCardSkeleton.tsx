"use client";

import { Card, Skeleton } from "@packages/ui";
import { cn } from "@packages/utils";

export interface ShowcaseCardSkeletonProps {
  className?: string;
}

export function ShowcaseCardSkeleton({ className }: ShowcaseCardSkeletonProps) {
  return (
    <Card
      className={cn(
        "flex flex-col justify-between overflow-hidden border border-border/60 bg-card p-5 shadow-xs",
        className,
      )}
    >
      <div className="flex flex-col gap-4">
        {/* Верхняя строка: аватар, имя, бейдж срочности */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 rounded-full shrink-0" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-3 w-20 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>

        {/* Заголовок карточки */}
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-3/4 rounded-md" />
          <div className="flex flex-wrap items-center gap-1.5">
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="h-5 w-14 rounded-md" />
          </div>
        </div>

        {/* Навыки */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Skeleton className="h-5 w-14 rounded-md" />
          <Skeleton className="h-5 w-18 rounded-md" />
          <Skeleton className="h-5 w-12 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>

        {/* Bio */}
        <div className="space-y-1.5 pt-1">
          <Skeleton className="h-3 w-full rounded-md" />
          <Skeleton className="h-3 w-5/6 rounded-md" />
        </div>
      </div>

      {/* Футер */}
      <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-4">
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
    </Card>
  );
}
