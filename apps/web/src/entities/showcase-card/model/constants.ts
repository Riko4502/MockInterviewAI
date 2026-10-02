import type {
  ExperienceLevel,
  InterviewLanguage,
  Specialization,
} from "@packages/dto";
import {
  BugIcon,
  CodeIcon,
  GlobeIcon,
  HubConnectionIcon,
  type IconProps,
  MaximizeIcon,
  PackageIcon,
  SettingsIcon,
  SlidersIcon,
  TrendUpIcon,
} from "@packages/icons";
import type { ComponentType } from "react";

export interface LevelConfigItem {
  key: ExperienceLevel;
  className: string;
  badgeVariant?:
    | "tag"
    | "statusSuccess"
    | "statusInfo"
    | "statusDanger"
    | "confirmed"
    | "ready"
    | "waiting";
}

export const LEVEL_CONFIG: Record<ExperienceLevel, LevelConfigItem> = {
  JUNIOR: {
    key: "JUNIOR",
    className:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium",
  },
  MIDDLE: {
    key: "MIDDLE",
    className:
      "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 font-medium",
  },
  SENIOR: {
    key: "SENIOR",
    className:
      "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-medium",
  },
  LEAD: {
    key: "LEAD",
    className:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-medium",
  },
};

export interface SpecializationConfigItem {
  key: Specialization;
  icon: ComponentType<IconProps>;
  className: string;
}

export const SPECIALIZATION_CONFIG: Record<
  Specialization,
  SpecializationConfigItem
> = {
  FRONTEND: {
    key: "FRONTEND",
    icon: CodeIcon,
    className: "text-blue-500",
  },
  BACKEND: {
    key: "BACKEND",
    icon: SlidersIcon,
    className: "text-emerald-500",
  },
  FULLSTACK: {
    key: "FULLSTACK",
    icon: PackageIcon,
    className: "text-violet-500",
  },
  DEVOPS: {
    key: "DEVOPS",
    icon: SettingsIcon,
    className: "text-orange-500",
  },
  QA: {
    key: "QA",
    icon: BugIcon,
    className: "text-rose-500",
  },
  MOBILE: {
    key: "MOBILE",
    icon: MaximizeIcon,
    className: "text-cyan-500",
  },
  DATA_ML: {
    key: "DATA_ML",
    icon: TrendUpIcon,
    className: "text-purple-500",
  },
  SYSTEM_DESIGN: {
    key: "SYSTEM_DESIGN",
    icon: HubConnectionIcon,
    className: "text-amber-500",
  },
};

export const LANGUAGE_CONFIG: Record<
  InterviewLanguage,
  { key: InterviewLanguage; icon: ComponentType<IconProps> }
> = {
  RU: { key: "RU", icon: GlobeIcon },
  EN: { key: "EN", icon: GlobeIcon },
  ANY: { key: "ANY", icon: GlobeIcon },
};
