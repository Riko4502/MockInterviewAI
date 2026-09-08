"use client";

import { useTranslation } from "react-i18next";

export function HeroMetrics() {
  const { t } = useTranslation("landing");

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t border-white/10 w-full max-w-2xl">
      <div className="space-y-0.5">
        <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
          {t("hero.metric1Value")}
        </div>
        <div className="text-xs font-medium text-slate-400">
          {t("hero.metric1Label")}
        </div>
      </div>
      <div className="space-y-0.5">
        <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
          {t("hero.metric2Value")}
        </div>
        <div className="text-xs font-medium text-slate-400">
          {t("hero.metric2Label")}
        </div>
      </div>
      <div className="space-y-0.5">
        <div className="text-2xl sm:text-3xl font-extrabold text-violet-400 font-mono">
          {t("hero.metric3Value")}
        </div>
        <div className="text-xs font-medium text-slate-400">
          {t("hero.metric3Label")}
        </div>
      </div>
      <div className="space-y-0.5">
        <div className="text-2xl sm:text-3xl font-extrabold text-indigo-300 font-mono">
          {t("hero.metric4Value")}
        </div>
        <div className="text-xs font-medium text-slate-400">
          {t("hero.metric4Label")}
        </div>
      </div>
    </div>
  );
}
