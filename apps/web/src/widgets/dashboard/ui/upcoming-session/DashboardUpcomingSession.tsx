"use client";

import { UserIcon } from "@packages/icons";
import { Avatar, Button, Card, Empty, Typography } from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";
import { formatDashboardDate, formatDashboardTime } from "../../lib/formatters";
import { DASHBOARD_KEYS } from "../../model/query-keys";
import { useUpcomingSession } from "../../model/use-dashboard-queries";
import { DashboardUpcomingSkeleton } from "./DashboardUpcomingSkeleton";
import { SessionCountdownTimer } from "./SessionCountdownTimer";

const QuickMediaCheckDialog = lazy(() =>
  import("@/features/media-settings").then((module) => ({
    default: module.QuickMediaCheckDialog,
  })),
);

export function DashboardUpcomingSession() {
  const { t, i18n } = useTranslation("dashboard");
  const queryClient = useQueryClient();
  const query = useUpcomingSession();
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaRequested, setMediaRequested] = useState(false);
  const [timeZone, setTimeZone] = useState("UTC");
  const mediaTrigger = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const session = query.data?.session;

  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  }, []);

  const refreshUpcoming = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: DASHBOARD_KEYS.upcoming(),
      exact: true,
    });
  }, [queryClient]);

  if (query.isPending) return <DashboardUpcomingSkeleton />;

  if (!query.data) {
    return (
      <Card className="min-h-72">
        <div
          role="alert"
          className="flex min-h-60 flex-col items-center justify-center gap-4 text-center"
        >
          <Typography as="h2" variant="large">
            {t("upcomingSession.title")}
          </Typography>
          <Typography variant="muted">{t("errors.upcomingSession")}</Typography>
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t("errors.retry")}
          </Button>
        </div>
      </Card>
    );
  }

  if (!query.data.hasUpcoming || !session) {
    return (
      <Card className="min-h-72">
        <Empty
          className="min-h-60"
          title={t("upcomingSession.emptyTitle")}
          description={t("upcomingSession.emptyDescription")}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href={paths.sandbox}>
                  {t("upcomingSession.createRoom")}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`${paths.dashboard}#live-match`}>
                  {t("upcomingSession.findPartner")}
                </Link>
              </Button>
            </div>
          }
        />
      </Card>
    );
  }

  const partner = session.partner;
  const partnerName = partner?.displayName?.trim() || partner?.username?.trim();
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en" : "ru";
  const date = formatDashboardDate(session.scheduledAt, locale, timeZone);
  const time = formatDashboardTime(session.scheduledAt, locale, timeZone);

  return (
    <>
      <Card className="min-h-72 gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2
            ref={titleRef}
            tabIndex={-1}
            className="text-lg font-semibold outline-none"
          >
            {t("upcomingSession.title")}
          </h2>
          <Typography variant="muted">
            {t(`upcomingSession.roles.${session.role}`)}
          </Typography>
        </div>
        <Typography as="h3" variant="h3" className="break-words text-lg">
          {session.title}
        </Typography>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="font-medium">{t("upcomingSession.date")}: </span>
            <time dateTime={session.scheduledAt}>{date}</time>
          </p>
          <p>
            <span className="font-medium">{t("upcomingSession.time")}: </span>
            <time dateTime={session.scheduledAt}>{time}</time>
          </p>
        </div>
        {partner && (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-12 shrink-0">
              {partner.avatarUrl && (
                <Avatar.Image src={partner.avatarUrl} alt="" />
              )}
              <Avatar.Fallback
                aria-label={partnerName ?? t("upcomingSession.partnerFallback")}
              >
                {partnerName ? (
                  partnerName.slice(0, 1).toLocaleUpperCase()
                ) : (
                  <UserIcon aria-hidden="true" />
                )}
              </Avatar.Fallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium">
                {partnerName ?? t("upcomingSession.partnerFallback")}
              </p>
              {(partner.specialization || partner.level) && (
                <p className="truncate text-sm text-muted-foreground">
                  {[
                    partner.specialization
                      ? t(`specializations.${partner.specialization}`)
                      : null,
                    partner.level ? t(`levels.${partner.level}`) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>
        )}
        <SessionCountdownTimer
          seconds={session.secondsUntilStart}
          label={t("upcomingSession.startsIn")}
          onExpire={refreshUpcoming}
        />
        <div className="mt-auto flex flex-wrap gap-3">
          <Button
            asChild
            disabled={!session.isReadyToJoin}
            className="h-auto min-h-10 max-w-full whitespace-normal text-left"
          >
            <Link
              aria-disabled={!session.isReadyToJoin}
              tabIndex={session.isReadyToJoin ? undefined : -1}
              href={{ pathname: paths.sandbox, query: { room: session.id } }}
              onClick={(event) => {
                if (!session.isReadyToJoin) event.preventDefault();
              }}
            >
              {session.isReadyToJoin
                ? t("upcomingSession.join")
                : t("upcomingSession.joinUnavailable")}
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-10 max-w-full whitespace-normal text-left"
            ref={mediaTrigger}
            onClick={() => {
              setMediaRequested(true);
              setMediaOpen(true);
            }}
          >
            {t("upcomingSession.checkMedia")}
          </Button>
        </div>
      </Card>
      {mediaRequested && (
        <Suspense fallback={<output>{t("loading.section")}</output>}>
          <QuickMediaCheckDialog
            open={mediaOpen}
            onOpenChange={setMediaOpen}
            onSaved={() => {
              void queryClient.invalidateQueries({
                queryKey: DASHBOARD_KEYS.readiness(),
              });
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              (mediaTrigger.current ?? titleRef.current)?.focus();
            }}
          />
        </Suspense>
      )}
    </>
  );
}
