"use client";

import { CheckIcon, TrendUpIcon, ZapIcon } from "@packages/icons";
import { Badge, Card } from "@packages/ui";
import { useTranslation } from "react-i18next";
import { ScoreMetricCard } from "./ScoreMetricCard";
import { StepHeader } from "./StepHeader";

export function StepScorecard() {
  const { t } = useTranslation("landing");

  const SKILLS_BREAKDOWN = [
    {
      id: "algo",
      nameKey: "howItWorks.skillAlgo" as const,
      score: 96,
      commentKey: "howItWorks.skillAlgoComment" as const,
      gradient: "from-violet-600 via-indigo-500 to-purple-400",
      textColor: "text-violet-600 dark:text-violet-400",
    },
    {
      id: "arch",
      nameKey: "howItWorks.skillArch" as const,
      score: 92,
      commentKey: "howItWorks.skillArchComment" as const,
      gradient: "from-sky-600 via-blue-500 to-cyan-400",
      textColor: "text-sky-600 dark:text-sky-400",
    },
    {
      id: "comm",
      nameKey: "howItWorks.skillComm" as const,
      score: 88,
      commentKey: "howItWorks.skillCommComment" as const,
      gradient: "from-emerald-600 via-teal-500 to-emerald-400",
      textColor: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
      {/* Left Column: Clear Educational Explanation */}
      <div className="lg:col-span-6 flex flex-col items-start">
        <StepHeader
          stepNumber="04"
          tag={t("howItWorks.step4Tag")}
          title={t("howItWorks.step4Title")}
          description={t("howItWorks.step4Desc")}
        />

        {/* 3 Clear Feature Takeaways */}
        <div className="space-y-4 w-full mt-2">
          <Card className="p-4 rounded-2xl bg-black/[0.03] dark:bg-[#07070c]/90 border border-black/[0.06] dark:border-white/[0.08] flex flex-row items-start gap-3.5 backdrop-blur-xl shadow-none ring-0">
            <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0 mt-0.5">
              <ZapIcon className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-foreground">
                {t("howItWorks.step4Benefit1Title")}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {t("howItWorks.step4Benefit1Desc")}
              </div>
            </div>
          </Card>

          <Card className="p-4 rounded-2xl bg-black/[0.03] dark:bg-[#07070c]/90 border border-black/[0.06] dark:border-white/[0.08] flex flex-row items-start gap-3.5 backdrop-blur-xl shadow-none ring-0">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0 mt-0.5">
              <TrendUpIcon className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-foreground">
                {t("howItWorks.step4Benefit2Title")}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {t("howItWorks.step4Benefit2Desc")}
              </div>
            </div>
          </Card>

          <Card className="p-4 rounded-2xl bg-black/[0.03] dark:bg-[#07070c]/90 border border-black/[0.06] dark:border-white/[0.08] flex flex-row items-start gap-3.5 backdrop-blur-xl shadow-none ring-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
              <CheckIcon className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-foreground">
                {t("howItWorks.step4Benefit3Title")}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {t("howItWorks.step4Benefit3Desc")}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Right Column: Realistic Scorecard Studio Card */}
      <div className="lg:col-span-6">
        <Card className="apple-glass rounded-[28px] p-6 sm:p-7 border border-black/[0.08] dark:border-white/[0.08] shadow-2xl relative overflow-hidden backdrop-blur-2xl ring-0">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-600/10 dark:bg-emerald-600/15 blur-3xl pointer-events-none rounded-full" />

          {/* Header Strip */}
          <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.08] relative z-10">
            <div>
              <div className="text-xs font-mono text-muted-foreground">
                {t("howItWorks.sessionReport")}
              </div>
              <div className="text-base font-bold text-foreground mt-0.5">
                {t("howItWorks.reportRole")}
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <Badge
                variant="statusSuccess"
                className="font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold"
              >
                {t("howItWorks.scorecardTitle")}
              </Badge>
              <div className="text-2xl font-bold text-foreground font-mono">
                92{" "}
                <span className="text-sm text-muted-foreground font-normal">
                  / 100
                </span>
              </div>
            </div>
          </div>

          {/* 3 Metric Cards */}
          <div className="grid grid-cols-3 gap-2.5 my-4 relative z-10">
            <ScoreMetricCard
              value="O(n)"
              label={t("howItWorks.timeComplexity")}
            />
            <ScoreMetricCard
              value="O(1)"
              label={t("howItWorks.spaceComplexity")}
            />
            <ScoreMetricCard
              value="Top 2%"
              label={t("howItWorks.globalPercentile")}
              valueColor="text-emerald-600 dark:text-emerald-400"
            />
          </div>

          {/* Detailed Skill Breakdown */}
          <div className="space-y-3 my-4 relative z-10">
            {SKILLS_BREAKDOWN.map((skill) => (
              <Card
                key={skill.id}
                className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] shadow-none gap-1.5 ring-0"
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-foreground">
                    {t(skill.nameKey)}
                  </span>
                  <span className={`font-mono font-bold ${skill.textColor}`}>
                    {skill.score}%
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="relative h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${skill.gradient}`}
                    style={{ width: `${skill.score}%` }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {t(skill.commentKey)}
                </div>
              </Card>
            ))}
          </div>

          {/* Recommendation Box */}
          <Card className="p-4 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20 dark:border-emerald-500/30 text-xs text-foreground leading-relaxed shadow-sm relative z-10 ring-0">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300 mr-1.5">
              {t("howItWorks.keyRecommendation")}
            </span>
            <span>{t("howItWorks.recommendationText")}</span>
          </Card>
        </Card>
      </div>
    </div>
  );
}
