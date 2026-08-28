"use client";

import { useLandingTranslations } from "@/shared/lib";
import { ScoreMetricCard } from "./ScoreMetricCard";
import { SkillProgressBar } from "./SkillProgressBar";
import { StepHeader } from "./StepHeader";

export function StepScorecard() {
  const { landing } = useLandingTranslations();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
      <div className="lg:col-span-6 lg:order-2 flex flex-col items-start">
        <StepHeader
          stepNumber="04"
          tag={landing.howItWorks.step4Tag}
          title={landing.howItWorks.step4Title}
          description={landing.howItWorks.step4Desc}
        />
        <div className="space-y-4 w-full">
          <SkillProgressBar
            label={landing.howItWorks.skillAlgo}
            scoreText="96 / 100"
            percentage={96}
          />
          <SkillProgressBar
            label={landing.howItWorks.skillArch}
            scoreText="92 / 100"
            percentage={92}
          />
          <SkillProgressBar
            label={landing.howItWorks.skillComm}
            scoreText="88 / 100"
            percentage={88}
          />
        </div>
      </div>

      <div className="lg:col-span-6 lg:order-1">
        <div className="glass-panel rounded-2xl p-6 border border-white/15 shadow-xl glow-card">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <div className="text-xs font-mono text-slate-400">
                {landing.howItWorks.sessionReport}
              </div>
              <div className="text-base font-bold text-white">
                {landing.howItWorks.reportRole}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono">
                {landing.howItWorks.scorecardTitle}
              </div>
              <div className="text-[11px] text-slate-400">
                {landing.howItWorks.scoreLabel}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 my-4">
            <ScoreMetricCard
              value="O(n)"
              label={landing.howItWorks.timeComplexity}
            />
            <ScoreMetricCard
              value="O(1)"
              label={landing.howItWorks.spaceComplexity}
            />
            <ScoreMetricCard
              value={landing.howItWorks.topPercentile}
              label={landing.howItWorks.globalPercentile}
              valueColor="text-violet-400"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-violet-950/50 border border-violet-500/30 text-xs text-slate-300 leading-relaxed shadow-sm">
            <span className="font-semibold text-violet-300">
              {landing.howItWorks.keyRecommendation}
            </span>{" "}
            {landing.howItWorks.recommendationText}
          </div>
        </div>
      </div>
    </div>
  );
}
