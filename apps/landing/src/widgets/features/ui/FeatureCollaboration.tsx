"use client";

import { DotIcon, HubConnectionIcon } from "@packages/icons";
import { Badge, Card, Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";

export function FeatureCollaboration() {
  const { t } = useTranslation("landing");

  return (
    <Card className="w-full h-full relative rounded-[28px] sm:rounded-[32px] p-5 sm:p-8 md:p-10 apple-glass border border-black/[0.08] dark:border-white/[0.08] flex flex-col justify-between group hover:border-violet-500/30 dark:hover:border-violet-400/30 transition-all duration-500 overflow-hidden ring-0">
      {/* Corner Ambient Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 dark:bg-violet-600/15 blur-3xl pointer-events-none rounded-full transition-opacity group-hover:opacity-100 opacity-60" />

      <div className="mb-8 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 flex items-center justify-center text-white mb-6 shadow-lg shadow-violet-600/25 group-hover:scale-105 transition-transform duration-300">
          <HubConnectionIcon className="w-6 h-6" />
        </div>
        <Typography.H3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-3">
          {t("features.card1Title")}
        </Typography.H3>
        <Typography.Lead className="text-muted-foreground text-sm sm:text-base font-normal leading-relaxed">
          {t("features.card1Desc")}
        </Typography.Lead>
      </div>

      <div className="relative z-10">
        <Card className="rounded-2xl bg-black/[0.03] dark:bg-[#07070c]/90 border border-black/[0.06] dark:border-white/[0.08] p-3.5 sm:p-5 font-mono text-xs text-foreground backdrop-blur-xl shadow-none ring-0">
          <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-1 pb-2.5 mb-2.5 border-b border-black/[0.06] dark:border-white/[0.08] text-[11px] text-muted-foreground">
            <span className="text-violet-600 dark:text-violet-400 font-semibold flex items-center gap-1.5">
              <DotIcon className="w-4 h-4 text-violet-500 animate-pulse shrink-0" />
              <span>{t("features.card1AiCopilot")}</span>
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-medium text-[10px] sm:text-[11px] pl-5 xs:pl-0">
              {t("features.card1Synced")}
            </span>
          </div>
          <div className="space-y-2 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Badge
                variant="statusInfo"
                className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-300 text-[10px] border border-violet-500/25 font-mono"
              >
                {t("features.card1InterviewerTag")}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {t("features.card1InterviewerAction")}
              </span>
            </div>
            <Card className="p-3.5 rounded-xl bg-violet-500/5 dark:bg-violet-950/40 border border-violet-500/20 dark:border-violet-500/30 text-violet-700 dark:text-violet-200 mt-2 text-xs leading-relaxed shadow-none ring-0">
              <span className="font-semibold text-violet-800 dark:text-violet-100 mr-1">
                {t("features.card1HintLabel")}
              </span>
              {t("features.card1HintText")}
            </Card>
          </div>
        </Card>
      </div>
    </Card>
  );
}
