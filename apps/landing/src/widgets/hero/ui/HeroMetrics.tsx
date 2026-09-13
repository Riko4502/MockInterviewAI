"use client";

import { useTranslation } from "react-i18next";
import { HERO_METRICS } from "../constants";

export function HeroMetrics() {
  const { t } = useTranslation("landing");

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t border-white/10 w-full max-w-2xl">
      {HERO_METRICS.map((metric) => (
        <div key={metric.id} className="space-y-0.5">
          <div className={metric.valueClassName}>{t(metric.valueKey)}</div>
          <div className="text-xs font-medium text-slate-400">
            {t(metric.labelKey)}
          </div>
        </div>
      ))}
    </div>
  );
}
