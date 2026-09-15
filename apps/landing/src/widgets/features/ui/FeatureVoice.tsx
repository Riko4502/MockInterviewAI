"use client";

import { MicIcon } from "@packages/icons";
import { Card, Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";

export function FeatureVoice() {
  const { t } = useTranslation("landing");

  return (
    <Card className="w-full h-full relative rounded-3xl p-8 border border-slate-200/80 dark:border-indigo-500/20 bg-white/70 dark:bg-gradient-to-b dark:from-indigo-950/20 dark:via-[#0c0e1a]/80 dark:to-[#07080e]/90 backdrop-blur-xl flex flex-col justify-between group hover:border-indigo-500/40 hover:shadow-2xl hover:shadow-indigo-500/10 dark:hover:shadow-indigo-950/50 transition-all duration-300 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none">
      {/* Corner Ambient Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/10 dark:bg-indigo-600/15 blur-3xl pointer-events-none rounded-full" />

      <Card.Header className="p-0 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 border border-indigo-400/40 flex items-center justify-center text-white mb-6 shadow-lg shadow-indigo-600/30 group-hover:scale-110 group-hover:shadow-indigo-500/50 transition-all">
          <MicIcon className="w-6 h-6" />
        </div>
        <Typography.H3 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
          {t("features.card2Title")}
        </Typography.H3>
        <Card.Description className="text-muted-foreground text-sm leading-relaxed mb-6">
          {t("features.card2Desc")}
        </Card.Description>
      </Card.Header>

      <Card.Content className="p-0 relative z-10">
        <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-[#0a0c16]/90 border border-slate-200/80 dark:border-indigo-500/20 flex items-center justify-between shadow-inner">
          <div>
            <div className="text-xs text-indigo-600 dark:text-indigo-300">
              {t("features.card2SpeakingPace")}
            </div>
            <div className="text-xl font-bold text-foreground font-mono mt-0.5 flex items-center gap-2">
              <span>{t("features.card2Wpm")}</span>
              {/* Dynamic Sound Equalizer Waveform */}
              <div className="flex items-end gap-0.5 h-4">
                <span className="w-0.5 bg-indigo-500 rounded-full animate-equalizer-1" />
                <span className="w-0.5 bg-purple-500 rounded-full animate-equalizer-2" />
                <span className="w-0.5 bg-violet-500 rounded-full animate-equalizer-3" />
                <span className="w-0.5 bg-emerald-500 rounded-full animate-equalizer-4" />
                <span className="w-0.5 bg-indigo-500 rounded-full animate-equalizer-5" />
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">
              {t("features.card2FillerWords")}
            </div>
            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
              {t("features.card2Optimal")}
            </div>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}
