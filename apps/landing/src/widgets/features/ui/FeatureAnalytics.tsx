"use client";

import { TrendUpIcon } from "@packages/icons";
import { Card, Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";

export function FeatureAnalytics() {
  const { t } = useTranslation("landing");

  return (
    <Card className="w-full h-full relative rounded-3xl p-8 border border-slate-200/80 dark:border-emerald-500/20 bg-white/70 dark:bg-gradient-to-b dark:from-emerald-950/20 dark:via-[#0c0e1a]/80 dark:to-[#07080e]/90 backdrop-blur-xl flex flex-col justify-between group hover:border-emerald-500/40 hover:shadow-2xl hover:shadow-emerald-500/10 dark:hover:shadow-emerald-950/50 transition-all duration-300 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none">
      {/* Corner Ambient Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-600/10 dark:bg-emerald-600/15 blur-3xl pointer-events-none rounded-full" />

      <Card.Header className="p-0 mb-6 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 border border-emerald-400/40 flex items-center justify-center text-white mb-6 shadow-lg shadow-emerald-600/30 group-hover:scale-110 group-hover:shadow-emerald-500/50 transition-all">
          <TrendUpIcon className="w-6 h-6" />
        </div>
        <Typography.H3 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
          {t("features.card4Title")}
        </Typography.H3>
        <Card.Description className="text-muted-foreground text-sm sm:text-base leading-relaxed">
          {t("features.card4Desc")}
        </Card.Description>
      </Card.Header>

      <Card.Content className="p-0 relative z-10">
        <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-[#0a0c16]/90 border border-slate-200/80 dark:border-emerald-500/20 grid grid-cols-3 gap-4 text-center shadow-inner font-mono">
          <div>
            <div className="text-2xl font-extrabold text-foreground">96.8%</div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-300/80 mt-1 font-sans">
              {t("features.card4AlgoAccuracy")}
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-violet-600 dark:text-violet-400">
              4.9 / 5.0
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 font-sans">
              {t("features.card4SystemArch")}
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              Top 3%
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-300/80 mt-1 font-sans">
              {t("features.card4GlobalBenchmark")}
            </div>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}
