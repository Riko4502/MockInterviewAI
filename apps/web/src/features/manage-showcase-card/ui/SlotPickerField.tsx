"use client";

import { MAX_SLOTS_PER_CARD } from "@packages/dto";
import { CalendarIcon, ClockIcon, PlusIcon, TrashIcon } from "@packages/icons";
import { Badge, Button, Field, Input, Select } from "@packages/ui";
import {
  formatInstantInTimeZone,
  LOCAL_DATE_TIME_REGEX,
  resolveLocalTimeToUtc,
} from "@packages/utils";
import { type ChangeEvent, useState } from "react";
import {
  type Control,
  type FieldArrayWithId,
  useFieldArray,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import type { ShowcaseFormValues } from "../model/showcase-form-schema";

/** Пресеты длительности интервью в минутах (спека §3). */
export const DURATION_PRESETS = [30, 45, 60, 90, 120] as const;

const SLOT_LABEL_PATTERN = "EEE, d MMM HH:mm";

export interface SlotPickerFieldProps {
  control: Control<ShowcaseFormValues>;
  /** IANA-таймзона автора: в ней вводятся и показываются слоты (ADR-002:53). */
  authorTimezone: string;
  className?: string;
}

function formatSlotLabel(
  startsAtLocal: string,
  timeZone: string,
  locale: string,
): string {
  const resolution = resolveLocalTimeToUtc(startsAtLocal, timeZone);

  if (!resolution.ok) {
    return startsAtLocal.replace("T", " ");
  }

  return formatInstantInTimeZone(
    resolution.utc,
    timeZone,
    SLOT_LABEL_PATTERN,
    locale,
  );
}

/**
 * Конструктор слотов доступности в форме анкеты.
 *
 * Слоты вводятся в локальном времени автора (`authorTimezone`) и уходят на
 * сервер как `startsAtLocal`. Занятые (BOOKED) слоты показываются только для
 * чтения: их нельзя удалить, и они не сериализуются в DTO.
 */
export function SlotPickerField({
  control,
  authorTimezone,
  className,
}: SlotPickerFieldProps) {
  const { t, i18n } = useTranslation("showcase");
  const { fields, append, remove } = useFieldArray({ control, name: "slots" });

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState<number>(60);
  const [error, setError] = useState<string | null>(null);

  const activeCount = fields.filter((field) => !field.booked).length;
  const isAtLimit = activeCount >= MAX_SLOTS_PER_CARD;
  const canAdd = !isAtLimit && date.length > 0 && time.length > 0;

  const handleAdd = () => {
    const startsAtLocal = `${date}T${time}`;

    if (!LOCAL_DATE_TIME_REGEX.test(startsAtLocal)) {
      setError(t("slots.cannotAddInPast"));
      return;
    }

    const resolution = resolveLocalTimeToUtc(startsAtLocal, authorTimezone);

    if (!resolution.ok || resolution.utc.getTime() <= Date.now()) {
      setError(t("slots.cannotAddInPast"));
      return;
    }

    setError(null);
    append({ startsAtLocal, durationMinutes: duration });
    setDate("");
    setTime("");
  };

  const renderSlot = (
    field: FieldArrayWithId<ShowcaseFormValues, "slots">,
    index: number,
  ) => {
    const label = formatSlotLabel(
      field.startsAtLocal,
      authorTimezone,
      i18n.language,
    );

    return (
      <li
        key={field.id}
        className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-2.5 py-1.5"
      >
        <div className="flex min-w-0 items-center gap-2 text-xs text-foreground">
          <ClockIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{label}</span>
          <span className="shrink-0 text-muted-foreground">
            · {t("slots.durationMinutes", { count: field.durationMinutes })}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {field.booked && (
            <Badge variant="secondary" className="text-[10px]">
              {t("slots.booked")}
            </Badge>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={field.booked}
            aria-label={
              field.booked ? t("slots.cannotDeleteBooked") : t("actions.delete")
            }
            title={field.booked ? t("slots.cannotDeleteBooked") : undefined}
            onClick={() => remove(index)}
            className="text-muted-foreground hover:text-destructive"
          >
            <TrashIcon className="size-3.5" />
          </Button>
        </div>
      </li>
    );
  };

  return (
    <Field invalid={!!error} className={className}>
      <Field.Label className="flex items-center justify-between">
        <span>{t("slots.title")}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {activeCount}/{MAX_SLOTS_PER_CARD}
        </span>
      </Field.Label>

      <Field.Content>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <CalendarIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={date}
              aria-label={t("slots.date")}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setDate(event.target.value)
              }
              className="pl-8"
            />
          </div>

          <Input
            type="time"
            value={time}
            aria-label={t("slots.startTime")}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setTime(event.target.value)
            }
            className="w-28"
          />

          <Select
            value={String(duration)}
            onValueChange={(value: string) => setDuration(Number(value))}
          >
            <Select.Trigger className="w-28" aria-label={t("slots.duration")}>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {DURATION_PRESETS.map((minutes) => (
                <Select.Item key={minutes} value={String(minutes)}>
                  {t("slots.durationMinutes", { count: minutes })}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canAdd}
            onClick={handleAdd}
            className="gap-1.5"
          >
            <PlusIcon className="size-3.5" />
            {isAtLimit ? t("slots.addSlotDisabledMax") : t("slots.addSlot")}
          </Button>
        </div>

        <Field.Error>{error ?? undefined}</Field.Error>
        <Field.Description>
          {t("slots.timeInYourTimezone", { timezone: authorTimezone })}
        </Field.Description>
      </Field.Content>

      {fields.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1.5">{fields.map(renderSlot)}</ul>
      )}
    </Field>
  );
}
