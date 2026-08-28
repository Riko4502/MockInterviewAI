"use client";

import { useLandingTranslations } from "@/shared/lib";
import { StepHeader } from "./StepHeader";
import { TrackCard } from "./TrackCard";

export function StepTrackSelect() {
  const { landing } = useLandingTranslations();

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
          <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:border-violet-500/40 transition-colors">
            {landing.howItWorks.trackTagFrontend}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:border-violet-500/40 transition-colors">
            {landing.howItWorks.trackTagBackend}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:border-violet-500/40 transition-colors">
            {landing.howItWorks.trackTagSystemDesign}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:border-violet-500/40 transition-colors">
            {landing.howItWorks.trackTagAlgo}
          </span>
        </div>
      </div>

      <div className="lg:col-span-6">
        <div className="glass-panel rounded-2xl p-6 border border-white/15 shadow-xl glow-card">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-400" />
              {landing.howItWorks.step1SelectTitle}
            </span>
            <span className="text-xs text-violet-400 font-medium font-mono">
              {landing.howItWorks.step1Customizable}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TrackCard
              title={landing.howItWorks.track1Title}
              description={landing.howItWorks.track1Desc}
              duration="60 min"
              statusText={landing.howItWorks.track1Status}
              selected={true}
            />
            <TrackCard
              title={landing.howItWorks.track2Title}
              description={landing.howItWorks.track2Desc}
              duration="45 min"
              statusText={landing.howItWorks.selectAction}
            />
            <TrackCard
              title={landing.howItWorks.track3Title}
              description={landing.howItWorks.track3Desc}
              duration="60 min"
              statusText={landing.howItWorks.selectAction}
            />
            <TrackCard
              title={landing.howItWorks.track4Title}
              description={landing.howItWorks.track4Desc}
              duration="45 min"
              statusText={landing.howItWorks.selectAction}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
