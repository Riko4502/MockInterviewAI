"use client";

import { ZapIcon } from "@packages/icons";
import { Badge } from "@packages/ui";
import { cn } from "@packages/utils";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";

export interface UrgentBadgeProps {
  className?: string;
  iconOnly?: boolean;
}

export function UrgentBadge({ className, iconOnly = false }: UrgentBadgeProps) {
  const { t } = useTranslation("showcase");

  return (
    <Badge
      variant="tag"
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md",
        "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
        "shadow-xs transition-colors",
        className,
      )}
      title={t("card.urgent")}
    >
      <ZapIcon className="size-3 shrink-0 fill-amber-500 text-amber-500 animate-pulse" />
      {!iconOnly && <span>{t("card.urgent")}</span>}
    </Badge>
  );
}
