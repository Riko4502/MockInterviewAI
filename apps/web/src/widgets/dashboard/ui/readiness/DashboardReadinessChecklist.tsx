"use client";

import { CheckIcon } from "@packages/icons";
import {
  Button,
  Card,
  Empty,
  Progress,
  Skeleton,
  Typography,
} from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { lazy, Suspense, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { DASHBOARD_KEYS } from "../../model/query-keys";
import { READINESS_ACTIONS } from "../../model/readiness-steps";
import { useReadinessChecklist } from "../../model/use-dashboard-queries";

const QuickMediaCheckDialog = lazy(() =>
  import("@/features/media-settings").then((module) => ({
    default: module.QuickMediaCheckDialog,
  })),
);

export function DashboardReadinessChecklist() {
  const { t } = useTranslation("dashboard");
  const id = useId();
  const query = useReadinessChecklist();
  const client = useQueryClient();
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaRequested, setMediaRequested] = useState(false);
  const mediaTrigger = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const complete = query.data?.totalPercentage === 100;

  if (query.isPending)
    return (
      <Card className="min-h-[30rem]">
        <output aria-label={t("readiness.loading")} className="block space-y-5">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-2 w-full" />
          {[0, 1, 2, 3, 4].map((step) => (
            <Skeleton key={step} className="h-16 w-full" />
          ))}
        </output>
      </Card>
    );

  if (!query.data)
    return (
      <Card className="flex min-h-[30rem] justify-center">
        <div role="alert" className="space-y-4">
          <Typography variant="muted">{t("readiness.loadError")}</Typography>
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

  return (
    <Card>
      <h2
        ref={titleRef}
        tabIndex={-1}
        id={`${id}-title`}
        className="text-lg font-semibold outline-none"
        aria-live="polite"
      >
        {complete
          ? t("readiness.ready")
          : t("readiness.heading", { percentage: query.data.totalPercentage })}
      </h2>
      <Progress
        value={query.data.totalPercentage}
        aria-labelledby={`${id}-title`}
        className="my-3 [&_[data-slot=progress-indicator]]:duration-300 motion-reduce:[&_[data-slot=progress-indicator]]:transition-none"
      />
      {query.isError && (
        <div role="alert" className="space-y-2">
          <p>{t("readiness.loadError")}</p>
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t("errors.retry")}
          </Button>
        </div>
      )}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 motion-reduce:transition-none ${complete ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}
        inert={complete}
        aria-hidden={complete}
      >
        <div className="min-h-0 overflow-hidden">
          {query.data.steps.length === 0 ? (
            <Empty title={t("readiness.empty")} />
          ) : (
            <ul className="divide-y divide-border">
              {query.data.steps.map((step) => {
                const action = READINESS_ACTIONS[step.key];
                return (
                  <li key={step.key} className="flex items-start gap-3 py-4">
                    {step.isCompleted ? (
                      <CheckIcon
                        aria-hidden="true"
                        className="mt-1 size-5 shrink-0 text-success"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="mt-1 size-5 shrink-0 rounded-full border border-border"
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="font-medium">
                        {t(`readiness.steps.${step.key}`)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t(`readiness.descriptions.${step.key}`)}
                      </p>
                      {step.isCompleted ? (
                        <span className="text-sm text-success">
                          {t("readiness.completed")}
                        </span>
                      ) : (
                        <>
                          <span className="sr-only">
                            {t("readiness.incomplete")}
                          </span>
                          {action.kind === "media" ? (
                            <Button
                              ref={mediaTrigger}
                              variant="outline"
                              className="h-auto min-h-8 whitespace-normal text-left"
                              onClick={() => {
                                setMediaRequested(true);
                                setMediaOpen(true);
                              }}
                            >
                              {t(`readiness.actions.${step.key}`)}
                            </Button>
                          ) : action.kind === "link" ? (
                            <Button
                              asChild
                              variant="outline"
                              className="h-auto min-h-8 whitespace-normal text-left"
                            >
                              <Link href={action.href}>
                                {t(`readiness.actions.${step.key}`)}
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              disabled
                              variant="outline"
                              className="h-auto min-h-8 whitespace-normal text-left"
                            >
                              {t(`readiness.actions.${step.key}`)}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      {mediaRequested && (
        <Suspense fallback={<output>{t("loading.section")}</output>}>
          <QuickMediaCheckDialog
            open={mediaOpen}
            onOpenChange={setMediaOpen}
            onSaved={() => {
              void client.invalidateQueries({
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
    </Card>
  );
}
