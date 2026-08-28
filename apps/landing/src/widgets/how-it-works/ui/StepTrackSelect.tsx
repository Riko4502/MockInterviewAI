"use client";

import { useState } from "react";
import { useLandingTranslations } from "@/shared/lib";
import { StepHeader } from "./StepHeader";
import { TrackCard } from "./TrackCard";

export function StepTrackSelect() {
  const { landing } = useLandingTranslations();
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);

  const tracks = [
    {
      title: landing.howItWorks.track1Title,
      description: landing.howItWorks.track1Desc,
      duration: "60 min",
    },
    {
      title: landing.howItWorks.track2Title,
      description: landing.howItWorks.track2Desc,
      duration: "45 min",
    },
    {
      title: landing.howItWorks.track3Title,
      description: landing.howItWorks.track3Desc,
      duration: "60 min",
    },
    {
      title: landing.howItWorks.track4Title,
      description: landing.howItWorks.track4Desc,
      duration: "45 min",
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
      <div className="lg:col-span-6 flex flex-col items-start">
        <StepHeader
          stepNumber="01"
          tag={landing.howItWorks.step1Tag}
          title={landing.howItWorks.step1Title}
          description={landing.howItWorks.step1Desc}
        />
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="px-3 py-1.5 rounded-lg bg-purple-950/30 border border-purple-500/20 text-purple-200 hover:border-purple-500/50 transition-colors">
            {landing.howItWorks.trackTagFrontend}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-purple-950/30 border border-purple-500/20 text-purple-200 hover:border-purple-500/50 transition-colors">
            {landing.howItWorks.trackTagBackend}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-purple-950/30 border border-purple-500/20 text-purple-200 hover:border-purple-500/50 transition-colors">
            {landing.howItWorks.trackTagSystemDesign}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-purple-950/30 border border-purple-500/20 text-purple-200 hover:border-purple-500/50 transition-colors">
            {landing.howItWorks.trackTagAlgo}
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
              {landing.howItWorks.step1SelectTitle}
            </span>
            <span className="text-xs text-purple-400 font-medium font-mono">
              {landing.howItWorks.step1Customizable}
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
                      ? landing.howItWorks.track1Status
                      : landing.howItWorks.selectAction
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
