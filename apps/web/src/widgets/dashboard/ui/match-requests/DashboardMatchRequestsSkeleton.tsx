"use client";

import { Card, Skeleton } from "@packages/ui";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";

export function DashboardMatchRequestsSkeleton() {
  const { t } = useTranslation("dashboard");
  return (
    <Card
      aria-busy="true"
      aria-label={t("matchRequests.loading")}
      className="min-h-64 gap-4"
    >
      <Skeleton className="h-6 w-48" />
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex gap-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-16 flex-1" />
        </div>
      ))}
    </Card>
  );
}
