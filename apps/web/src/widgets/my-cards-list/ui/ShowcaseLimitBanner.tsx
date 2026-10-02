"use client";

import { AlertCircleIcon } from "@packages/icons";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";

export interface ShowcaseLimitBannerProps {
  activeCount: number;
  maxCount?: number;
  className?: string;
}

export function ShowcaseLimitBanner({
  activeCount,
  maxCount = 5,
  className,
}: ShowcaseLimitBannerProps) {
  const { t } = useTranslation("showcase");
  const isLimitReached = activeCount >= maxCount;
  const percentage = Math.min(100, Math.round((activeCount / maxCount) * 100));

  return (
    <div
      className={`flex flex-col gap-2.5 rounded-2xl border p-4 shadow-2xs backdrop-blur-xs transition-colors ${
        isLimitReached
          ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "border-border/60 bg-card/60 text-foreground"
      } ${className || ""}`}
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-medium">
          {isLimitReached && (
            <AlertCircleIcon className="size-4 shrink-0 text-amber-500" />
          )}
          <span>
            {t("limits.activeCount", { current: activeCount, max: maxCount })}
          </span>
        </div>
        <span className="font-mono text-muted-foreground">{percentage}%</span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isLimitReached ? "bg-amber-500" : "bg-primary"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {isLimitReached && (
        <p className="text-[11px] text-amber-600/90 dark:text-amber-400/90">
          {t("limits.limitReached")}
        </p>
      )}
    </div>
  );
}
