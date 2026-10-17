"use client";

import { Button, Combobox, type ComboboxGroup } from "@packages/ui";
import { cn } from "@packages/utils";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import {
  buildTimeZoneList,
  getBrowserTimezone,
  groupTimezones,
  regionToKey,
} from "../lib/timezones";

const REGION_LABEL_KEYS = {
  utc: "profile.regions.utc",
  europe: "profile.regions.europe",
  asia: "profile.regions.asia",
  africa: "profile.regions.africa",
  america: "profile.regions.america",
  australia: "profile.regions.australia",
  pacific: "profile.regions.pacific",
  atlantic: "profile.regions.atlantic",
  indian: "profile.regions.indian",
  antarctica: "profile.regions.antarctica",
  other: "profile.regions.other",
} as const;

export interface TimezoneSelectProps {
  /** Текущая IANA-таймзона (controlled). */
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
}

/**
 * Селектор таймзоны с поиском, группировкой по регионам и автоопределением
 * из браузера (ADR-002:53). Подписи зон — города (имена собственные, не
 * переводятся), заголовки регионов локализуются.
 */
export function TimezoneSelect({
  value,
  onValueChange,
  disabled,
  className,
  id,
  name,
  "aria-label": ariaLabel,
}: TimezoneSelectProps) {
  const { t } = useTranslation("showcase");

  const groups = useMemo<ComboboxGroup[]>(() => {
    return groupTimezones(buildTimeZoneList(value)).map((group) => {
      const regionKey =
        REGION_LABEL_KEYS[
          regionToKey(group.region) as keyof typeof REGION_LABEL_KEYS
        ] ?? "profile.regions.other";

      return {
        key: group.region,
        label: t(regionKey),
        options: group.items.map((item) => ({
          value: item.id,
          label: item.label,
          keywords: [item.id],
        })),
      };
    });
  }, [value, t]);

  const handleDetect = () => {
    const detected = getBrowserTimezone();
    if (detected) {
      onValueChange(detected);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Combobox
        id={id}
        name={name}
        value={value}
        onValueChange={onValueChange}
        groups={groups}
        disabled={disabled}
        aria-label={ariaLabel ?? t("profile.timezone")}
        placeholder={t("profile.timezone")}
        searchPlaceholder={t("profile.timezoneSearchPlaceholder")}
        emptyText={t("profile.timezoneEmpty")}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={handleDetect}
      >
        {t("profile.detectTimezone")}
      </Button>
    </div>
  );
}
