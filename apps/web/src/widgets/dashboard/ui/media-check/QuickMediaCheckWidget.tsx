"use client";

import { Button, Card, Typography } from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { DASHBOARD_KEYS } from "../../model/query-keys";

const QuickMediaCheckDialog = lazy(() =>
  import("@/features/media-settings").then((module) => ({
    default: module.QuickMediaCheckDialog,
  })),
);

export function QuickMediaCheckWidget() {
  const { t } = useTranslation("dashboard");
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <Card className="min-w-0 gap-4">
      <Typography as="h2" variant="large">
        {t("mediaCheck.title")}
      </Typography>
      <p className="text-sm text-muted-foreground">
        {t("mediaCheck.widgetDescription")}
      </p>
      <Button
        ref={trigger}
        variant="outline"
        className="h-auto min-h-10 whitespace-normal"
        onClick={() => {
          setRequested(true);
          setOpen(true);
        }}
      >
        {t("upcomingSession.checkMedia")}
      </Button>
      {requested && (
        <Suspense fallback={<output>{t("loading.section")}</output>}>
          <QuickMediaCheckDialog
            open={open}
            onOpenChange={setOpen}
            onSaved={() => {
              void client.invalidateQueries({
                queryKey: DASHBOARD_KEYS.readiness(),
              });
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              trigger.current?.focus();
            }}
          />
        </Suspense>
      )}
    </Card>
  );
}
