"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StepHeader } from "./StepHeader";
import { TrackCard } from "./TrackCard";

export function StepTrackSelect() {
  const { t } = useTranslation("landing");
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);

  const tracks = [
    {
      title: t("howItWorks.track1Title"),
      description: t("howItWorks.track1Desc"),
      duration: "60 min",
    },
    {
      title: t("howItWorks.track2Title"),
      description: t("howItWorks.track2Desc"),
      duration: "45 min",
    },
    {
      title: t("howItWorks.track3Title"),
      description: t("howItWorks.track3Desc"),
      duration: "60 min",
    },
    {
      title: t("howItWorks.track4Title"),
      description: t("howItWorks.track4Desc"),
      duration: "45 min",
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
      <div className="lg:col-span-6 flex flex-col items-start">
        <StepHeader
          stepNumber="01"
          tag={t("howItWorks.step1Tag")}
          title={t("howItWorks.step1Title")}
          description={t("howItWorks.step1Desc")}
        />
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="px-3 py-1.5 rounded-lg bg-purple-950/30 border border-purple-500/20 text-purple-200 hover:border-purple-500/50 transition-colors">
            {t("howItWorks.trackTagFrontend")}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-purple-950/30 border border-purple-500/20 text-purple-200 hover:border-purple-500/50 transition-colors">
            {t("howItWorks.trackTagBackend")}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-purple-950/30 border border-purple-500/20 text-purple-200 hover:border-purple-500/50 transition-colors">
            {t("howItWorks.trackTagSystemDesign")}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-purple-950/30 border border-purple-500/20 text-purple-200 hover:border-purple-500/50 transition-colors">
            {t("howItWorks.trackTagAlgo")}
          </span>
        </div>
      </div>

      <div className="lg:col-span-6">
        <div className="glass-panel rounded-2xl p-6 border border-purple-500/30 shadow-xl glow-card relative overflow-hidden bg-gradient-to-b from-purple-950/20 to-[#0a0c16]/90">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-purple-600/15 blur-3xl pointer-events-none rounded-full" />

          <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10 relative z-10">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              {t("howItWorks.step1SelectTitle")}
            </span>
            <span className="text-xs text-purple-400 font-medium font-mono">
              {t("howItWorks.step1Customizable")}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10">
            {tracks.map((track, idx) => (
              <button
                type="button"
                key={track.title}
                onClick={() => setSelectedTrackIndex(idx)}
                className="w-full text-left cursor-pointer transition-transform active:scale-98"
              >
                <TrackCard
                  title={track.title}
                  description={track.description}
                  duration={track.duration}
                  statusText={
                    selectedTrackIndex === idx
                      ? t("howItWorks.track1Status")
                      : t("howItWorks.selectAction")
                  }
                  selected={selectedTrackIndex === idx}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
