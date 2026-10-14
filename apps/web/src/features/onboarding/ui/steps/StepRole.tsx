"use client";

import {
  BugIcon,
  CheckIcon,
  CodeIcon,
  HubConnectionIcon,
  NodeIcon,
  PackageIcon,
  PythonIcon,
  ReactIcon,
} from "@packages/icons";
import { cn } from "@packages/utils";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import type { OnboardingRole } from "../../model/types";

interface StepRoleProps {
  selectedRole: OnboardingRole;
  onSelectRole: (role: OnboardingRole) => void;
}

interface RoleOptionConfig {
  id: OnboardingRole;
  icon: ComponentType<{ className?: string; size?: "sm" | "default" | "lg" }>;
  badge: string;
}

const ROLE_OPTIONS: RoleOptionConfig[] = [
  { id: "FRONTEND", icon: ReactIcon, badge: "React / Vue / Next" },
  { id: "BACKEND", icon: NodeIcon, badge: "Node / Go / Java / Py" },
  { id: "FULLSTACK", icon: CodeIcon, badge: "Frontend + Backend" },
  { id: "SYSTEM_DESIGN", icon: HubConnectionIcon, badge: "HighLoad / Arch" },
  { id: "DEVOPS", icon: PackageIcon, badge: "K8s / CI-CD / Cloud" },
  { id: "QA", icon: BugIcon, badge: "Autotests / E2E / API" },
  { id: "DATA_ML", icon: PythonIcon, badge: "ML / Data / AI" },
  { id: "MOBILE", icon: CodeIcon, badge: "iOS / Android / RN" },
];

export function StepRole({ selectedRole, onSelectRole }: StepRoleProps) {
  const { t } = useTranslation("common");

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center sm:text-left">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {t("onboarding.step1.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("onboarding.step1.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {ROLE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedRole === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelectRole(option.id)}
              className={cn(
                "group relative flex items-start gap-4 p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer select-none",
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20"
                  : "border-border/70 bg-card hover:border-border hover:bg-muted/30",
              )}
            >
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-lg border transition-colors",
                  isSelected
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border/60 bg-muted/40 text-muted-foreground group-hover:text-foreground",
                )}
              >
                <Icon className="size-5" />
              </div>

              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-sm">
                    {t(`onboarding.roles.${option.id}.title`)}
                  </span>
                  <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
                    {option.badge}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {t(`onboarding.roles.${option.id}.desc`)}
                </p>
              </div>

              <div
                className={cn(
                  "absolute right-3.5 top-3.5 flex size-5 items-center justify-center rounded-full border transition-all",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 bg-background opacity-0 group-hover:opacity-60",
                )}
              >
                {isSelected && <CheckIcon className="size-3 stroke-[3]" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
