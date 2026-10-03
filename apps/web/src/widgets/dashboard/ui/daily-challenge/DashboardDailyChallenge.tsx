"use client";

import { Alert, Badge, Button, Card, Skeleton, Typography } from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";
import { getDailyChallengeBadgeVariant } from "../../lib/daily-challenge";
import { DASHBOARD_KEYS } from "../../model/query-keys";
import { useDailyChallenge } from "../../model/use-dashboard-queries";
import { DailyChallengeCountdown } from "./DailyChallengeCountdown";

export function DashboardDailyChallenge() {
  const { t } = useTranslation("dashboard");
  const queryClient = useQueryClient();
  const query = useDailyChallenge();
  const refreshChallenge = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: DASHBOARD_KEYS.dailyChallenge(),
      exact: true,
    });
  }, [queryClient]);

  if (query.isPending) {
    return (
      <Card className="min-h-72 space-y-5">
        <Skeleton className="h-6 w-2/5" />
        <Skeleton className="h-7 w-4/5" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-auto h-10 w-48" />
      </Card>
    );
  }

  if (!query.data) {
    return (
      <Card className="min-h-72">
        <Alert variant="destructive">
          <Alert.Title>{t("dailyChallenge.title")}</Alert.Title>
          <Alert.Description className="flex flex-wrap items-center justify-between gap-3">
            <span>{t("errors.dailyChallenge")}</span>
            <Button
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {t("errors.retry")}
            </Button>
          </Alert.Description>
        </Alert>
      </Card>
    );
  }

  const challenge = query.data;
  const tags = challenge.tags;

  return (
    <Card className="min-h-72 gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Typography as="h2" variant="large">
          {t("dailyChallenge.title")}
        </Typography>
        <Badge variant={getDailyChallengeBadgeVariant(challenge.difficulty)}>
          {t(`dailyChallenge.difficulty.${challenge.difficulty}`)}
        </Badge>
      </div>
      <Typography as="h3" variant="h3" className="break-words text-lg">
        {challenge.title}
      </Typography>
      {tags.length > 0 && (
        <ul
          aria-label={t("dailyChallenge.topics")}
          className="flex min-w-0 flex-wrap gap-2"
        >
          {tags.slice(0, 3).map((tag) => (
            <li key={tag} className="min-w-0 max-w-full">
              <Badge variant="tag" className="max-w-full truncate">
                {tag}
              </Badge>
            </li>
          ))}
          {tags.length > 3 && (
            <li>
              <Badge
                variant="tag"
                aria-label={t("dailyChallenge.moreTopics", {
                  count: tags.length - 3,
                })}
              >
                +{tags.length - 3}
              </Badge>
            </li>
          )}
        </ul>
      )}
      <DailyChallengeCountdown
        seconds={challenge.timeUntilResetSeconds}
        label={t("dailyChallenge.resetIn")}
        onExpire={refreshChallenge}
      />
      <div className="mt-auto">
        {challenge.isSolvedToday ? (
          <Alert variant="success">
            <Alert.Description>
              {t("dailyChallenge.solvedToday")}
            </Alert.Description>
          </Alert>
        ) : (
          <Button
            asChild
            className="h-auto min-h-10 max-w-full whitespace-normal text-left"
          >
            <Link
              href={{
                pathname: paths.sandbox,
                query: { problemId: challenge.problemId },
              }}
            >
              {t("dailyChallenge.solveWithReward", {
                points: challenge.pointsReward,
                streak: t("dailyChallenge.streak"),
              })}
            </Link>
          </Button>
        )}
      </div>
    </Card>
  );
}
