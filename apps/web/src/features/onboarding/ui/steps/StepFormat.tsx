"use client";

import {
  CheckIcon,
  CodeIcon,
  UsersIcon,
  WandIcon,
  ZapIcon,
} from "@packages/icons";
import { Badge, Card } from "@packages/ui";
import { cn } from "@packages/utils";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import type {
  OnboardingLevel,
  OnboardingRole,
  PracticeFormatId,
  TargetCompanyId,
} from "../../model/types";

interface StepFormatProps {
  selectedFormat: PracticeFormatId;
  onSelectFormat: (format: PracticeFormatId) => void;
  role: OnboardingRole;
  level: OnboardingLevel;
  companies: TargetCompanyId[];
}

interface FormatOptionConfig {
  id: PracticeFormatId;
  icon: ComponentType<{ className?: string }>;
  tag: string;
}

const FORMAT_OPTIONS: FormatOptionConfig[] = [
  { id: "ai", icon: WandIcon, tag: "AI 24/7" },
  { id: "peer", icon: UsersIcon, tag: "Сообщество" },
  { id: "sandbox", icon: CodeIcon, tag: "Лайвкодинг" },
];

export function StepFormat({
  selectedFormat,
  onSelectFormat,
  role,
  level,
  companies,
}: StepFormatProps) {
  const { t } = useTranslation("common");

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center sm:text-left">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {t("onboarding.step3.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("onboarding.step3.subtitle")}
        </p>
      </div>

      {/* Format options */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {FORMAT_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedFormat === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelectFormat(option.id)}
              className={cn(
                "group relative flex flex-col justify-between p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer select-none",
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20"
                  : "border-border/70 bg-card hover:border-border hover:bg-muted/30",
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg border transition-colors",
                      isSelected
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border/60 bg-muted/40 text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                  </div>

                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted/70 text-muted-foreground">
                    {t(`onboarding.formats.${option.id}.tag`, {
                      defaultValue: option.tag,
                    })}
                  </span>
                </div>

                <div className="font-semibold text-foreground text-sm">
                  {t(`onboarding.formats.${option.id}.title`)}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  {t(`onboarding.formats.${option.id}.desc`)}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-end">
                <div
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border transition-all",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/60 bg-background opacity-40 group-hover:opacity-70",
                  )}
                >
                  {isSelected && <CheckIcon className="size-3 stroke-[3]" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Personalized preview card */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card p-5 mt-2">
        <div className="flex items-center gap-2 mb-2">
          <ZapIcon className="size-4 text-primary" />
          <Badge variant="ready" className="text-[11px]">
            {t("onboarding.step3.previewBadge")}
          </Badge>
        </div>

        <h3 className="text-base font-bold text-foreground">
          {t("onboarding.step3.previewTitle")}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("onboarding.step3.previewSubtitle")}
        </p>

        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <Badge variant="tag" className="font-semibold text-xs">
            {t(`onboarding.roles.${role}.title`)}
          </Badge>
          <span className="text-muted-foreground text-xs">•</span>
          <Badge variant="tag" className="font-semibold text-xs">
            {t(`onboarding.levels.${level}.title`)}
          </Badge>
          {companies.length > 0 && (
            <>
              <span className="text-muted-foreground text-xs">•</span>
              {companies.map((c) => (
                <span
                  key={c}
                  className="text-xs px-2 py-0.5 rounded bg-muted/60 text-muted-foreground font-medium"
                >
                  {t(`onboarding.companies.${c}.title`)}
                </span>
              ))}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
