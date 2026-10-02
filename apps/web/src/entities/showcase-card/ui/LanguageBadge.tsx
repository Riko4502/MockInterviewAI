"use client";

import type { InterviewLanguage } from "@packages/dto";
import { GlobeIcon } from "@packages/icons";
import { Badge } from "@packages/ui";
import { cn } from "@packages/utils";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";

export interface LanguageBadgeProps {
  language: InterviewLanguage;
  className?: string;
}

export function LanguageBadge({ language, className }: LanguageBadgeProps) {
  const { t } = useTranslation("showcase");
  const label = t(`languages.${language}`);

  return (
    <Badge
      variant="tag"
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs text-muted-foreground border-border/50 bg-background/60",
        className,
      )}
    >
      <GlobeIcon className="size-3 shrink-0 text-muted-foreground/80" />
      <span>{label}</span>
    </Badge>
  );
}
