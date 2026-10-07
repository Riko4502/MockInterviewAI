"use client";

import { Skeleton, Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { DashboardStatsLayout, STAT_METRICS } from "./DashboardStatsLayout";
import { StatMetricCard } from "./StatMetricCard";

export function DashboardStatsSkeleton() {
  const { t } = useTranslation("dashboard");
  return (
    <section
      aria-busy="true"
      aria-label={t("statistics.title")}
      className="space-y-4"
    >
      <Typography as="h2" variant="large">
        {t("statistics.title")}
      </Typography>
      <DashboardStatsLayout>
        {STAT_METRICS.map((metric) => (
          <StatMetricCard
            key={metric}
            label={t(`statistics.${metric}`)}
            value={<Skeleton className="h-9 w-24" />}
          >
            <Skeleton className="h-5 w-3/4" />
          </StatMetricCard>
        ))}
      </DashboardStatsLayout>
    </section>
  );
}
