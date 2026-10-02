"use client";

import type { Specialization } from "@packages/dto";
import { Badge } from "@packages/ui";
import { cn } from "@packages/utils";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { SPECIALIZATION_CONFIG } from "../model/constants";

export interface SpecializationBadgeProps {
  specialization: Specialization;
  showIcon?: boolean;
  className?: string;
}

export function SpecializationBadge({
  specialization,
  showIcon = true,
  className,
}: SpecializationBadgeProps) {
  const { t } = useTranslation("showcase");
  const config =
    SPECIALIZATION_CONFIG[specialization] ?? SPECIALIZATION_CONFIG.FRONTEND;
  const Icon = config.icon;
  const label = t(`specializations.${specialization}`);

  return (
    <Badge
      variant="tag"
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-md border border-border/60 bg-muted/40 text-foreground",
        className,
      )}
    >
      {showIcon && (
        <Icon className={cn("size-3.5 shrink-0", config.className)} />
      )}
      <span>{label}</span>
    </Badge>
  );
}
