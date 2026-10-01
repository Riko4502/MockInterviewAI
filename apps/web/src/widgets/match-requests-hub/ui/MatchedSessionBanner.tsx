"use client";

import { CheckIcon, PlayIcon } from "@packages/icons";
import { Button } from "@packages/ui";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";

export interface MatchedSessionBannerProps {
  sessionId?: string | null;
  className?: string;
}

export function MatchedSessionBanner({
  sessionId,
  className,
}: MatchedSessionBannerProps) {
  const { t } = useTranslation("showcase");

  return (
    <div
      className={`mt-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        className || ""
      }`}
    >
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-xs text-emerald-400 flex items-center gap-1.5">
          <CheckIcon className="size-3.5" />
          {t("matchmaking.matchedTitle")}
        </span>
        <span className="text-[11px] text-muted-foreground leading-snug">
          {t("matchmaking.matchedDesc")}
        </span>
      </div>
      {sessionId ? (
        <Button
          asChild
          size="sm"
          variant="default"
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shrink-0 shadow-xs gap-1.5 cursor-pointer"
        >
          <Link href={`${paths.sandbox}?room=${sessionId}`}>
            <PlayIcon className="size-3.5 fill-current" />
            <span>{t("matchmaking.goToInterview")}</span>
          </Link>
        </Button>
      ) : (
        <Button
          size="sm"
          variant="default"
          disabled
          className="bg-emerald-600/70 text-white font-semibold text-xs shrink-0 shadow-xs gap-1.5 opacity-80 cursor-wait"
        >
          <span className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          <span>{t("matchmaking.preparingRoom")}</span>
        </Button>
      )}
    </div>
  );
}
