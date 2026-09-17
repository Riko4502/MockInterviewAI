"use client";

import { MicIcon } from "@packages/icons";
import { Card, Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";

export function FeatureVoice() {
  const { t } = useTranslation("landing");

  return (
    <Card className="w-full h-full relative rounded-[28px] sm:rounded-[32px] p-5 sm:p-8 md:p-10 apple-glass border border-black/[0.08] dark:border-white/[0.08] flex flex-col justify-between group hover:border-pink-500/30 dark:hover:border-pink-400/30 transition-all duration-500 overflow-hidden ring-0">
      {/* Corner Ambient Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-pink-600/10 dark:bg-pink-600/15 blur-3xl pointer-events-none rounded-full transition-opacity group-hover:opacity-100 opacity-60" />

      <div className="mb-8 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 flex items-center justify-center text-white mb-6 shadow-lg shadow-pink-600/25 group-hover:scale-105 transition-transform duration-300">
          <MicIcon className="w-6 h-6" />
        </div>
        <Typography.H3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-3">
          {t("features.card2Title")}
        </Typography.H3>
        <Typography.Lead className="text-muted-foreground text-sm sm:text-base font-normal leading-relaxed">
          {t("features.card2Desc")}
        </Typography.Lead>
      </div>

      <div className="relative z-10">
        <Card className="p-5 rounded-2xl bg-black/[0.03] dark:bg-[#07070c]/90 border border-black/[0.06] dark:border-white/[0.08] flex flex-row items-center justify-between backdrop-blur-xl shadow-none ring-0">
          <div>
            <div className="text-xs text-pink-600 dark:text-pink-400 font-medium">
              {t("features.card2SpeakingPace")}
            </div>
            <div className="text-xl font-bold text-foreground font-mono mt-1 flex items-center gap-3">
              <span>{t("features.card2Wpm")}</span>
              {/* Dynamic Sound Equalizer Waveform */}
              <div className="flex items-end gap-1 h-5">
                <span className="w-1 bg-pink-500 rounded-full animate-siri-1" />
                <span className="w-1 bg-purple-500 rounded-full animate-siri-2" />
                <span className="w-1 bg-violet-500 rounded-full animate-siri-3" />
                <span className="w-1 bg-cyan-400 rounded-full animate-siri-4" />
                <span className="w-1 bg-emerald-400 rounded-full animate-siri-5" />
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">
              {t("features.card2FillerWords")}
            </div>
            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
              {t("features.card2Optimal")}
            </div>
          </div>
        </Card>
      </div>
    </Card>
  );
}
