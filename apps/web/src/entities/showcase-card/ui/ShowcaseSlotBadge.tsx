"use client";

import { ClockIcon } from "@packages/icons";
import type { AvailabilitySlot } from "@packages/types";
import { cn, formatInstantInTimeZone } from "@packages/utils";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";

/** Краткий формат начала слота: день недели, дата и время. */
const SLOT_BADGE_PATTERN = "EEE, d MMM HH:mm";

export interface ShowcaseSlotBadgeProps {
  slot: Pick<AvailabilitySlot, "startsAt" | "durationMinutes">;
  /** IANA-таймзона смотрящего (ADR-002:55). */
  viewerTimezone: string;
  /** Локаль названий дня/месяца (`ru` / `en`). */
  locale?: string;
  className?: string;
}

/**
 * Компактный бейдж слота: время начала в таймзоне смотрящего и длительность.
 */
export function ShowcaseSlotBadge({
  slot,
  viewerTimezone,
  locale,
  className,
}: ShowcaseSlotBadgeProps) {
  const { t } = useTranslation("showcase");

  const startsAtLabel = formatInstantInTimeZone(
    slot.startsAt,
    viewerTimezone,
    SLOT_BADGE_PATTERN,
    locale,
  );

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border/30 bg-muted/30 px-2 py-1 text-xs text-muted-foreground",
        className,
      )}
    >
      <ClockIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="whitespace-nowrap">{startsAtLabel}</span>
      <span className="text-muted-foreground/60" aria-hidden="true">
        ·
      </span>
      <span className="whitespace-nowrap">
        {t("slots.durationMinutes", { count: slot.durationMinutes })}
      </span>
    </span>
  );
}
