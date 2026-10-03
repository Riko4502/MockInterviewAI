"use client";

import type { ExperienceLevel } from "@packages/dto";
import { Badge } from "@packages/ui";
import { cn } from "@packages/utils";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { LEVEL_CONFIG } from "../model/constants";

export interface LevelBadgeProps {
  level: ExperienceLevel;
  className?: string;
}

export function LevelBadge({ level, className }: LevelBadgeProps) {
  const { t } = useTranslation("showcase");
  const config = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.MIDDLE;
  const label = t(`levels.${level}`);

  return (
    <Badge
      variant="tag"
      className={cn(
        "px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-md border",
        config.className,
        className,
      )}
    >
      {label}
    </Badge>
  );
}
