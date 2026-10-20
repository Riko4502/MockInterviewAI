"use client";

import type { AvailabilitySlot } from "@packages/types";
import { cn } from "@packages/utils";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { ShowcaseSlotBadge } from "./ShowcaseSlotBadge";

/** Сколько ближайших слотов показывать в карточке витрины (ADR-002:83). */
export const MAX_VISIBLE_SLOTS = 3;

export interface ShowcaseSlotsListProps {
  slots: readonly AvailabilitySlot[];
  /** IANA-таймзона смотрящего (ADR-002:55). */
  viewerTimezone: string;
  /** Максимум видимых бейджей; остальные сворачиваются в `+N ещё`. */
  maxVisible?: number;
  className?: string;
}

/**
 * Список актуальных открытых слотов карточки витрины.
 *
 * Показывает только `status === "OPEN"` и будущие слоты (`startsAt > now`) в
 * таймзоне смотрящего, отсортированные по возрастанию начала. Если актуальных
 * слотов нет — блок не рендерится.
 */
export function ShowcaseSlotsList({
  slots,
  viewerTimezone,
  maxVisible = MAX_VISIBLE_SLOTS,
  className,
}: ShowcaseSlotsListProps) {
  const { t, i18n } = useTranslation("showcase");
  const now = Date.now();

  const upcomingSlots = slots
    .filter(
      (slot) =>
        slot.status === "OPEN" && new Date(slot.startsAt).getTime() > now,
    )
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );

  if (upcomingSlots.length === 0) {
    return null;
  }

  const visibleSlots = upcomingSlots.slice(0, maxVisible);
  const hiddenCount = upcomingSlots.length - visibleSlots.length;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-medium text-muted-foreground">
        {t("slots.upcomingSlots")}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {visibleSlots.map((slot) => (
          <ShowcaseSlotBadge
            key={slot.id}
            slot={slot}
            viewerTimezone={viewerTimezone}
            locale={i18n.language}
          />
        ))}
        {hiddenCount > 0 && (
          <span className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 px-1.5 py-0.5 text-xs text-muted-foreground">
            {t("slots.moreCount", { count: hiddenCount })}
          </span>
        )}
      </div>
    </div>
  );
}
