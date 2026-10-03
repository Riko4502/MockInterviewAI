"use client";

import {
  Alert,
  Badge,
  Button,
  Card,
  Skeleton,
  Typography,
  useToast,
} from "@packages/ui";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { useShowcaseBumpMutation } from "../../model/use-dashboard-mutations";
import { useShowcaseStatus } from "../../model/use-dashboard-queries";

export function DashboardShowcaseBanner() {
  const { t } = useTranslation("dashboard");
  const query = useShowcaseStatus();
  const mutation = useShowcaseBumpMutation();
  const toast = useToast();
  const locked = useRef(false);
  const card = query.data?.hasActiveCard ? query.data.card : null;

  async function bump() {
    if (!card?.canBump || locked.current) return;
    locked.current = true;
    try {
      await mutation.mutateAsync({ id: card.id });
      toast.push({ status: "success", title: t("showcase.bumpSuccess") });
    } catch {
      toast.push({ status: "error", title: t("errors.showcaseBump") });
    } finally {
      locked.current = false;
    }
  }

  if (query.isPending)
    return (
      <Card
        aria-busy="true"
        aria-label={t("showcase.loading")}
        className="min-h-48 gap-4"
      >
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-5 w-64 max-w-full" />
        <Skeleton className="h-10 w-36" />
      </Card>
    );

  return (
    <Card className="gap-4">
      <Typography as="h2" variant="large">
        {t("showcase.title")}
      </Typography>
      {!query.data ? (
        <Alert variant="destructive">
          <Alert.Description>{t("errors.showcase")}</Alert.Description>
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t("errors.retry")}
          </Button>
        </Alert>
      ) : !card ? (
        <>
          <Badge variant="secondary">{t("showcase.inactive")}</Badge>
          <p className="text-sm text-muted-foreground">
            {t("emptyStates.showcase")}
          </p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">{t("showcase.active")}</Badge>
            <p>{t("showcase.daysLeft", { count: card.daysLeft })}</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <p>{t("showcase.views", { count: card.viewsCount })}</p>
            <p>
              {t("showcase.requests", { count: card.incomingRequestsCount })}
            </p>
          </div>
          <div>
            <Button
              disabled={!card.canBump || mutation.isPending}
              onClick={() => void bump()}
            >
              {t("showcase.bump")}
            </Button>
          </div>
          {!card.canBump && (
            <p className="text-sm text-muted-foreground">
              {t("showcase.bumpUnavailable")}
            </p>
          )}
        </>
      )}
    </Card>
  );
}
