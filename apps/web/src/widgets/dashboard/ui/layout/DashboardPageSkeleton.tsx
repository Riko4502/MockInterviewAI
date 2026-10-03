"use client";

import { Card, Skeleton } from "@packages/ui";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { DashboardStatsSkeleton } from "../analytics/DashboardStatsSkeleton";
import { DashboardMatchRequestsSkeleton } from "../match-requests/DashboardMatchRequestsSkeleton";
import { DashboardQuickActions } from "../quick-actions/DashboardQuickActions";
import { DashboardListSkeleton } from "../shared/DashboardListSkeleton";
import { DashboardUpcomingSkeleton } from "../upcoming-session/DashboardUpcomingSkeleton";
import { DashboardFrame } from "./DashboardFrame";

export function DashboardPageSkeleton() {
  const { t } = useTranslation("dashboard");
  return (
    <DashboardFrame
      header={
        <>
          <Card aria-busy="true" className="gap-6 lg:grid lg:grid-cols-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </Card>
          <DashboardQuickActions />
        </>
      }
      primary={
        <>
          <DashboardListSkeleton title={t("readiness.title")} rows={5} />
          <DashboardUpcomingSkeleton />
          <DashboardListSkeleton title={t("dailyChallenge.title")} rows={2} />
          <DashboardStatsSkeleton />
          <DashboardListSkeleton title={t("aiInsights.title")} rows={2} />
          <DashboardListSkeleton title={t("recentSessions.title")} />
        </>
      }
      secondary={
        <>
          <DashboardMatchRequestsSkeleton />
          <Card aria-busy="true" className="min-h-48 gap-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-10 w-36" />
          </Card>
          <Card aria-busy="true" className="gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-10 w-full" />
          </Card>
        </>
      }
    />
  );
}
