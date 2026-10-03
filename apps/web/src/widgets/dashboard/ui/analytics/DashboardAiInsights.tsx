"use client";

import { Badge, Button, Card, Typography } from "@packages/ui";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { getPracticeHref } from "../../lib/get-practice-href";
import { useAiInsights } from "../../model/use-dashboard-queries";
import { DashboardListSkeleton } from "../shared/DashboardListSkeleton";
import { DashboardWidgetError } from "../shared/DashboardWidgetError";

export function DashboardAiInsights() {
  const { t } = useTranslation("dashboard");
  const query = useAiInsights();
  if (query.isPending)
    return <DashboardListSkeleton title={t("aiInsights.title")} rows={2} />;
  return (
    <Card className="min-h-72 min-w-0 gap-4">
      <Typography as="h2" variant="large">
        {t("aiInsights.title")}
      </Typography>
      {!query.data ? (
        <DashboardWidgetError
          busy={query.isFetching}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          {query.data.overallSummary && (
            <p className="text-sm [overflow-wrap:anywhere]">
              {query.data.overallSummary}
            </p>
          )}
          {query.data.insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("emptyStates.aiInsights")}
            </p>
          ) : (
            <ul className="space-y-5">
              {query.data.insights.map((insight) => {
                const href = getPracticeHref(insight.practiceUrl);
                return (
                  <li
                    key={insight.id}
                    className="min-w-0 space-y-3 border-b border-border pb-5 last:border-0 last:pb-0"
                  >
                    <Badge
                      variant="secondary"
                      className="max-w-full whitespace-normal"
                    >
                      {t(`aiInsights.categories.${insight.category}`)}
                    </Badge>
                    <Typography
                      as="h3"
                      variant="large"
                      className="[overflow-wrap:anywhere]"
                    >
                      {insight.headline}
                    </Typography>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground [overflow-wrap:anywhere]">
                      {insight.recommendation}
                    </p>
                    {href && (
                      <Button
                        asChild
                        variant="outline"
                        className="h-auto min-h-10 max-w-full whitespace-normal"
                      >
                        <Link href={href}>{t("aiInsights.practice")}</Link>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
