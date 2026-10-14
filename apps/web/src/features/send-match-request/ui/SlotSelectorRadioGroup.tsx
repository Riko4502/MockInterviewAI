"use client";

import { ClockIcon } from "@packages/icons";
import type { AvailabilitySlot } from "@packages/types";
import { RadioGroup } from "@packages/ui";
import { cn, formatInstantInTimeZone } from "@packages/utils";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";

/** Формат даты/времени начала слота в выборе: `15 января, 19:00`. */
const SLOT_OPTION_PATTERN = "d MMMM, HH:mm";

export interface SlotSelectorRadioGroupProps {
  slots: readonly AvailabilitySlot[];
  /** Выбранный `slotId`. */
  value?: string;
  /** Вызывается с `slotId` выбранного слота. */
  onChange: (slotId: string) => void;
  /** IANA-таймзона смотрящего (ADR-002:55). */
  viewerTimezone: string;
  /** Локаль названий месяца (`ru` / `en`). */
  locale?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Радиогруппа доступных слотов карточки для отправки отклика.
 *
 * Показывает только `status === "OPEN"` и будущие слоты (`startsAt > now`) в
 * таймзоне смотрящего, отсортированные по возрастанию начала. Если актуальных
 * слотов нет — ничего не рендерит (решение о подсказке принимает вызывающий).
 */
export function SlotSelectorRadioGroup({
  slots,
  value,
  onChange,
  viewerTimezone,
  locale,
  disabled,
  className,
}: SlotSelectorRadioGroupProps) {
  const { t } = useTranslation("showcase");
  const now = Date.now();

  const availableSlots = slots
    .filter(
      (slot) =>
        slot.status === "OPEN" && new Date(slot.startsAt).getTime() > now,
    )
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );

  if (availableSlots.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-sm font-medium text-foreground">
        {t("slots.chooseSlot")}
      </span>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        className="gap-2"
      >
        {availableSlots.map((slot) => {
          const itemId = `slot-option-${slot.id}`;
          const startsAtLabel = formatInstantInTimeZone(
            slot.startsAt,
            viewerTimezone,
            SLOT_OPTION_PATTERN,
            locale,
          );

          return (
            <label
              key={slot.id}
              htmlFor={itemId}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 transition-colors",
                "hover:bg-muted/40 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <RadioGroup.Item id={itemId} value={slot.id} />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium text-foreground">
                  {startsAtLabel}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <ClockIcon className="size-3.5 shrink-0" />
                  {t("slots.durationMinutes", { count: slot.durationMinutes })}
                </span>
              </span>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
