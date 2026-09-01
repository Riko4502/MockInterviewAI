"use client";

import { Badge } from "@packages/ui";
import { useState } from "react";
import { useLandingTranslations } from "@/shared/lib";
import { ScoreMetricCard } from "./ScoreMetricCard";
import { StepHeader } from "./StepHeader";

export function StepScorecard() {
  const { landing } = useLandingTranslations();
  const [algoScore, setAlgoScore] = useState(96);
  const [archScore, setArchScore] = useState(92);
  const [commScore, setCommScore] = useState(88);

  const averageScore = Math.round((algoScore + archScore + commScore) / 3);

  const getVerdict = (score: number) => {
    if (score >= 90)
      return {
        text: "STRONG HIRE",
        variant: "statusSuccess" as const,
        percentile: "Top 2%",
      };
    if (score >= 75)
      return {
        text: "HIRE",
        variant: "statusInfo" as const,
        percentile: "Top 15%",
      };
    return {
      text: "LEVELED UP",
      variant: "waiting" as const,
      percentile: "Top 35%",
    };
  };

  const verdict = getVerdict(averageScore);

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
          {/* Interactive Slider 1: Algo */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-violet-950/20 border border-violet-500/30 hover:border-violet-500/60 transition-all shadow-md">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                {landing.howItWorks.skillAlgo}
              </span>
              <span className="font-mono font-bold text-violet-300">
                {algoScore} / 100
              </span>
            </div>
            {/* Custom Glowing Bar */}
            <div className="relative h-2.5 rounded-full bg-slate-900 overflow-hidden border border-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-purple-400 shadow-[0_0_12px_rgba(139,92,246,0.8)] transition-all duration-150"
                style={{ width: `${algoScore}%` }}
              />
            </div>
            <input
              type="range"
              min="50"
              max="100"
              value={algoScore}
              onChange={(e) => setAlgoScore(Number(e.target.value))}
              className="w-full accent-violet-400 cursor-pointer h-1 bg-transparent opacity-60 hover:opacity-100 transition-opacity"
              aria-label={landing.howItWorks.skillAlgo}
            />
          </div>

          {/* Interactive Slider 2: Arch */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-sky-950/20 border border-sky-500/30 hover:border-sky-500/60 transition-all shadow-md">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                {landing.howItWorks.skillArch}
              </span>
              <span className="font-mono font-bold text-sky-300">
                {archScore} / 100
              </span>
            </div>
            {/* Custom Glowing Bar */}
            <div className="relative h-2.5 rounded-full bg-slate-900 overflow-hidden border border-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-600 via-blue-500 to-cyan-400 shadow-[0_0_12px_rgba(56,189,248,0.8)] transition-all duration-150"
                style={{ width: `${archScore}%` }}
              />
            </div>
            <input
              type="range"
              min="50"
              max="100"
              value={archScore}
              onChange={(e) => setArchScore(Number(e.target.value))}
              className="w-full accent-sky-400 cursor-pointer h-1 bg-transparent opacity-60 hover:opacity-100 transition-opacity"
              aria-label={landing.howItWorks.skillArch}
            />
          </div>

          {/* Interactive Slider 3: Comm */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 hover:border-emerald-500/60 transition-all shadow-md">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {landing.howItWorks.skillComm}
              </span>
              <span className="font-mono font-bold text-emerald-300">
                {commScore} / 100
              </span>
            </div>
            {/* Custom Glowing Bar */}
            <div className="relative h-2.5 rounded-full bg-slate-900 overflow-hidden border border-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)] transition-all duration-150"
                style={{ width: `${commScore}%` }}
              />
            </div>
            <input
              type="range"
              min="50"
              max="100"
              value={commScore}
              onChange={(e) => setCommScore(Number(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer h-1 bg-transparent opacity-60 hover:opacity-100 transition-opacity"
              aria-label={landing.howItWorks.skillComm}
            />
          </div>
        </div>
      </div>

      <div className="lg:col-span-6 lg:order-1">
        <div className="glass-panel rounded-2xl p-6 border border-emerald-500/30 shadow-xl glow-card relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-600/15 blur-2xl pointer-events-none rounded-full" />

          <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
            <div>
              <div className="text-xs font-mono text-slate-400">
                {landing.howItWorks.sessionReport}
              </div>
              <div className="text-base font-bold text-white">
                {landing.howItWorks.reportRole}
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <Badge
                variant={verdict.variant}
                className="font-mono text-[10px]"
              >
                {verdict.text}
              </Badge>
              <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono">
                {averageScore} / 100
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 my-4 relative z-10">
            <ScoreMetricCard
              value="O(n)"
              label={landing.howItWorks.timeComplexity}
            />
            <ScoreMetricCard
              value="O(1)"
              label={landing.howItWorks.spaceComplexity}
            />
            <ScoreMetricCard
              value={verdict.percentile}
              label={landing.howItWorks.globalPercentile}
              valueColor="text-emerald-400"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-slate-300 leading-relaxed shadow-sm relative z-10">
            <span className="font-semibold text-emerald-300">
              {landing.howItWorks.keyRecommendation}
            </span>{" "}
            {landing.howItWorks.recommendationText}
          </div>
        </div>
      </div>
    </div>
  );
}
