"use client";

import { CheckIcon, ClockIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import { useTranslation } from "react-i18next";
import type {
  OnboardingLevel,
  TargetCompanyId,
  TimelineId,
} from "../../model/types";

interface StepTargetProps {
  selectedLevel: OnboardingLevel;
  onSelectLevel: (level: OnboardingLevel) => void;
  selectedCompanies: TargetCompanyId[];
  onToggleCompany: (company: TargetCompanyId) => void;
  selectedTimeline: TimelineId;
  onSelectTimeline: (timeline: TimelineId) => void;
}

const LEVELS: OnboardingLevel[] = ["JUNIOR", "MIDDLE", "SENIOR", "LEAD"];

const COMPANIES: TargetCompanyId[] = [
  "bigtech",
  "fintech",
  "startup",
  "enterprise",
];

const TIMELINES: TimelineId[] = ["now", "soon", "passive"];

export function StepTarget({
  selectedLevel,
  onSelectLevel,
  selectedCompanies,
  onToggleCompany,
  selectedTimeline,
  onSelectTimeline,
}: StepTargetProps) {
  const { t } = useTranslation("common");

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center sm:text-left">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {t("onboarding.step2.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("onboarding.step2.subtitle")}
        </p>
      </div>

      {/* Target Level */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          {t("onboarding.step2.levelTitle")}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {LEVELS.map((level) => {
            const isSelected = selectedLevel === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => onSelectLevel(level)}
                className={cn(
                  "relative flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all cursor-pointer select-none",
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border/70 bg-card hover:border-border hover:bg-muted/30",
                )}
              >
                <span
                  className={cn(
                    "text-sm font-bold",
                    isSelected ? "text-primary" : "text-foreground",
                  )}
                >
                  {t(`onboarding.levels.${level}.title`)}
                </span>
                <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-tight">
                  {t(`onboarding.levels.${level}.desc`)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Target Companies (Multi-select) */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          {t("onboarding.step2.companiesTitle")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {COMPANIES.map((company) => {
            const isChecked = selectedCompanies.includes(company);
            return (
              <button
                key={company}
                type="button"
                onClick={() => onToggleCompany(company)}
                className={cn(
                  "relative flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer select-none",
                  isChecked
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border/70 bg-card hover:border-border hover:bg-muted/30",
                )}
              >
                <div className="pr-4">
                  <div className="text-sm font-medium text-foreground">
                    {t(`onboarding.companies.${company}.title`)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t(`onboarding.companies.${company}.desc`)}
                  </div>
                </div>

                <div
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
                    isChecked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40 bg-background",
                  )}
                >
                  {isChecked && <CheckIcon className="size-3.5 stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <ClockIcon className="size-4 text-muted-foreground" />
          <span>{t("onboarding.step2.timelineTitle")}</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {TIMELINES.map((timeline) => {
            const isSelected = selectedTimeline === timeline;
            return (
              <button
                key={timeline}
                type="button"
                onClick={() => onSelectTimeline(timeline)}
                className={cn(
                  "flex items-center justify-center px-4 py-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer select-none text-center",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border/70 bg-card text-foreground hover:bg-muted/40",
                )}
              >
                {t(`onboarding.timelines.${timeline}`)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
