"use client";

import { Card, Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { useDashboardStats } from "../../model/use-dashboard-queries";
import { DashboardWidgetError } from "../shared/DashboardWidgetError";
import { DashboardStatsLayout } from "./DashboardStatsLayout";
import { DashboardStatsSkeleton } from "./DashboardStatsSkeleton";
import { StatMetricCard } from "./StatMetricCard";

export function DashboardStatsGrid() {
  const { t, i18n } = useTranslation("dashboard");
  const query = useDashboardStats();
  if (query.isPending) return <DashboardStatsSkeleton />;
  const stats = query.data;
  const number = new Intl.NumberFormat(i18n.resolvedLanguage ?? "ru", {
    maximumFractionDigits: 2,
  });
  return (
    <section aria-label={t("statistics.title")} className="space-y-4">
      <Typography as="h2" variant="large">
        {t("statistics.title")}
      </Typography>
      {!stats ? (
        <Card className="min-h-40">
          <DashboardWidgetError
            busy={query.isFetching}
            retry={() => void query.refetch()}
          />
        </Card>
      ) : (
        <DashboardStatsLayout>
          <StatMetricCard
            label={t("statistics.totalInterviews")}
            value={number.format(stats.totalInterviews)}
          >
            {t("statistics.completedCount", {
              count: stats.completedInterviews,
            })}
          </StatMetricCard>
          <StatMetricCard
            label={t("statistics.currentStreak")}
            value={number.format(stats.currentStreakDays)}
          >
            {t("statistics.streakUnit")}
          </StatMetricCard>
          <StatMetricCard
            label={t("statistics.averageScore")}
            value={
              stats.averageScore === null
                ? "—"
                : `${number.format(stats.averageScore)} / 10`
            }
          >
            {stats.averageScore === null
              ? t("statistics.noScore")
              : t("statistics.scoreScale")}
          </StatMetricCard>
          <StatMetricCard
            label={t("statistics.solvedTasks")}
            value={number.format(stats.solvedTasks.total)}
          >
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              <li>
                {t("dailyChallenge.difficulty.EASY")}:{" "}
                {number.format(stats.solvedTasks.easy)}
              </li>
              <li>
                {t("dailyChallenge.difficulty.MEDIUM")}:{" "}
                {number.format(stats.solvedTasks.medium)}
              </li>
              <li>
                {t("dailyChallenge.difficulty.HARD")}:{" "}
                {number.format(stats.solvedTasks.hard)}
              </li>
            </ul>
          </StatMetricCard>
        </DashboardStatsLayout>
      )}
    </section>
  );
}
