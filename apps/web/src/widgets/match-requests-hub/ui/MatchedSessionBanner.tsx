"use client";

import type { MatchRequestResponseDtoSessionStatus } from "@packages/api";
import { CheckIcon, PlayIcon } from "@packages/icons";
import { Badge, Button } from "@packages/ui";
import { formatInstantInTimeZone } from "@packages/utils";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";

/** Формат отображения запланированного собеседования (ADR-002). */
const SCHEDULED_PATTERN = "d MMMM yyyy, HH:mm";

export interface MatchedSessionBannerProps {
  sessionId?: string | null;
  sessionStatus?: MatchRequestResponseDtoSessionStatus | null;
  /** UTC-инстант начала слота; при наличии показывается «Интервью запланировано на …». */
  scheduledAt?: string | null;
  /** IANA-таймзона смотрящего для форматирования `scheduledAt`. */
  viewerTimezone?: string;
  className?: string;
}

export function MatchedSessionBanner({
  sessionId,
  sessionStatus,
  scheduledAt,
  viewerTimezone = "UTC",
  className,
}: MatchedSessionBannerProps) {
  const { t, i18n } = useTranslation("showcase");
  const isClosed = sessionStatus === "CLOSED";

  const scheduledLabel = scheduledAt
    ? t("matchmaking.scheduledFor", {
        date: formatInstantInTimeZone(
          scheduledAt,
          viewerTimezone,
          SCHEDULED_PATTERN,
          i18n.language,
        ),
      })
    : null;

  return (
    <div
      className={`mt-2 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isClosed
          ? "bg-muted/30 border border-border/50"
          : "bg-emerald-500/10 border border-emerald-500/25"
      } ${className || ""}`}
    >
      <div className="flex flex-col gap-0.5">
        <span
          className={`font-semibold text-xs flex items-center gap-1.5 ${
            isClosed ? "text-foreground" : "text-emerald-400"
          }`}
        >
          <CheckIcon className="size-3.5" />
          {t("matchmaking.matchedTitle")}
        </span>
        <span className="text-[11px] text-muted-foreground leading-snug">
          {isClosed
            ? t("matchmaking.sessionFinished")
            : (scheduledLabel ?? t("matchmaking.matchedDesc"))}
        </span>
      </div>

      {isClosed ? (
        <Badge
          variant="secondary"
          className="text-xs font-medium py-1 px-2.5 shrink-0 self-start sm:self-auto"
        >
          {t("matchmaking.sessionFinished")}
        </Badge>
      ) : sessionId ? (
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
