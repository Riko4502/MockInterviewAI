"use client";

import { Card, Typography } from "@packages/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { formatDashboardDate } from "../../lib/formatters";
import { useRecentSessions } from "../../model/use-dashboard-queries";
import { DashboardListSkeleton } from "../shared/DashboardListSkeleton";
import { DashboardWidgetError } from "../shared/DashboardWidgetError";

export function DashboardRecentSessions() {
  const { t, i18n } = useTranslation("dashboard");
  const query = useRecentSessions({ limit: 5 });
  const [timeZone, setTimeZone] = useState("UTC");
  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  }, []);
  if (query.isPending)
    return <DashboardListSkeleton title={t("recentSessions.title")} />;
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en" : "ru";
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  return (
    <Card className="min-h-72 min-w-0 gap-4">
      <Typography as="h2" variant="large">
        {t("recentSessions.title")}
      </Typography>
      {!query.data ? (
        <DashboardWidgetError
          busy={query.isFetching}
          retry={() => void query.refetch()}
        />
      ) : query.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("emptyStates.recentSessions")}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {query.data.items.map((session) => (
            <li
              key={session.id}
              className="min-w-0 space-y-2 py-4 first:pt-0 last:pb-0"
            >
              <Typography
                as="h3"
                variant="large"
                className="[overflow-wrap:anywhere]"
              >
                {session.title}
              </Typography>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <time dateTime={session.completedAt}>
                  {formatDashboardDate(session.completedAt, locale, timeZone)}
                </time>
                <span>{t(`upcomingSession.roles.${session.role}`)}</span>
                <span>
                  {t("recentSessions.score")}:{" "}
                  {session.score == null
                    ? t("statistics.noScore")
                    : `${number.format(session.score)} / 10`}
                </span>
              </div>
              {/* В текущем контракте приложения отсутствуют маршрут и URL отчёта. */}
              <p className="text-sm text-muted-foreground">
                {t(
                  session.hasFeedbackReport
                    ? "recentSessions.reportUnavailable"
                    : "recentSessions.noReport",
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
