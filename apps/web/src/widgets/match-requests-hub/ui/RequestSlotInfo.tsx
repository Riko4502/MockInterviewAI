"use client";

import { ClockIcon } from "@packages/icons";
import type { AvailabilitySlot } from "@packages/types";
import { Badge, type BadgeVariant } from "@packages/ui";
import { cn, formatInstantInTimeZone } from "@packages/utils";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";

/** Формат плашки слота заявки: полная дата и время (ADR-002). */
const SLOT_PATTERN = "d MMMM yyyy, HH:mm";

const STATUS_KEY: Record<AvailabilitySlot["status"], string> = {
  OPEN: "slots.open",
  BOOKED: "slots.booked",
  CANCELLED: "slots.cancelled",
};

const STATUS_VARIANT: Record<AvailabilitySlot["status"], BadgeVariant> = {
  OPEN: "statusInfo",
  BOOKED: "statusSuccess",
  CANCELLED: "waiting",
};

export interface RequestSlotInfoProps {
  /** Слот заявки (`req.slot`); рендерится только при наличии. */
  slot: Pick<AvailabilitySlot, "startsAt" | "durationMinutes" | "status">;
  /** IANA-таймзона смотрящего (ADR-002:55). */
  viewerTimezone: string;
  className?: string;
}

/**
 * Акцентная плашка слота собеседования в карточке заявки.
 *
 * Показывает дату и время начала в таймзоне смотрящего, длительность и статус
 * слота (`OPEN` / `BOOKED` / `CANCELLED`). Форматирование — только через
 * `formatInstantInTimeZone` из `@packages/utils`.
 */
export function RequestSlotInfo({
  slot,
  viewerTimezone,
  className,
}: RequestSlotInfoProps) {
  const { t, i18n } = useTranslation("showcase");

  const startsAtLabel = formatInstantInTimeZone(
    slot.startsAt,
    viewerTimezone,
    SLOT_PATTERN,
    i18n.language,
  );

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md border border-primary/25 bg-primary/5 px-2.5 py-1.5 text-xs text-foreground",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 font-medium whitespace-nowrap">
        <ClockIcon
          className="size-3.5 shrink-0 text-primary"
          aria-hidden="true"
        />
        {startsAtLabel}
      </span>
      <span className="text-muted-foreground/60" aria-hidden="true">
        ·
      </span>
      <span className="text-muted-foreground whitespace-nowrap">
        {t("slots.durationMinutes", { count: slot.durationMinutes })}
      </span>
      <Badge
        variant={STATUS_VARIANT[slot.status]}
        size="default"
        className="px-2 py-0 text-[10px]"
      >
        {t(STATUS_KEY[slot.status])}
      </Badge>
    </div>
  );
}
