"use client";

import { useTranslation } from "react-i18next";
import { HERO_METRICS } from "../constants";

export function HeroMetrics() {
  const { t } = useTranslation("landing");

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 pt-8 border-t border-black/[0.08] dark:border-white/[0.08] w-full max-w-2xl">
      {HERO_METRICS.map((metric) => (
        <div key={metric.id} className="space-y-1">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono">
            {t(metric.valueKey)}
          </div>
          <div className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/80 tracking-wide">
            {t(metric.labelKey)}
          </div>
        </div>
      ))}
    </div>
  );
}
