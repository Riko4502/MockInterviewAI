"use client";

import { TrendUpIcon } from "@packages/icons";
import { Card, Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";

export function FeatureAnalytics() {
  const { t } = useTranslation("landing");

  return (
    <Card className="w-full h-full relative rounded-[28px] sm:rounded-[32px] p-5 sm:p-8 md:p-10 apple-glass border border-black/[0.08] dark:border-white/[0.08] flex flex-col justify-between group hover:border-emerald-500/30 dark:hover:border-emerald-400/30 transition-all duration-500 overflow-hidden ring-0">
      {/* Corner Ambient Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/10 dark:bg-emerald-600/15 blur-3xl pointer-events-none rounded-full transition-opacity group-hover:opacity-100 opacity-60" />

      <div className="mb-6 sm:mb-8 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-green-600 flex items-center justify-center text-white mb-6 shadow-lg shadow-emerald-600/25 group-hover:scale-105 transition-transform duration-300">
          <TrendUpIcon className="w-6 h-6" />
        </div>
        <Typography.H3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-3">
          {t("features.card4Title")}
        </Typography.H3>
        <Typography.Lead className="text-muted-foreground text-sm sm:text-base font-normal leading-relaxed">
          {t("features.card4Desc")}
        </Typography.Lead>
      </div>

      <div className="relative z-10">
        <Card className="p-3 sm:p-5 rounded-2xl bg-black/[0.03] dark:bg-[#07070c]/90 border border-black/[0.06] dark:border-white/[0.08] grid grid-cols-3 gap-1 sm:gap-4 text-center backdrop-blur-xl font-mono shadow-none ring-0">
          <div className="flex flex-col items-center justify-center min-w-0 px-0.5">
            <div className="text-base xs:text-xl sm:text-2xl md:text-3xl font-bold text-foreground truncate w-full">
              96.8%
            </div>
            <div className="text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-sans font-medium leading-tight">
              {t("features.card4AlgoAccuracy")}
            </div>
          </div>
          <div className="border-x border-black/[0.06] dark:border-white/[0.08] px-0.5 sm:px-2 flex flex-col items-center justify-center min-w-0">
            <div className="text-base xs:text-xl sm:text-2xl md:text-3xl font-bold text-violet-600 dark:text-violet-400 truncate w-full">
              4.9 / 5.0
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 font-sans font-medium leading-tight">
              {t("features.card4SystemArch")}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center min-w-0 px-0.5">
            <div className="text-base xs:text-xl sm:text-2xl md:text-3xl font-bold text-emerald-600 dark:text-emerald-400 truncate w-full">
              Top 3%
            </div>
            <div className="text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-sans font-medium leading-tight">
              {t("features.card4GlobalBenchmark")}
            </div>
          </div>
        </Card>
      </div>
    </Card>
  );
}
