"use client";

import { Button, Card, Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";

export function DashboardPageError({ reset }: { reset: () => void }) {
  const { t } = useTranslation("dashboard");
  return (
    <Card role="alert" className="mx-auto w-full max-w-7xl gap-4">
      <Typography as="h1" variant="h3">
        {t("errors.page")}
      </Typography>
      <p className="text-sm text-muted-foreground">
        {t("errors.pageDescription")}
      </p>
      <div>
        <Button onClick={reset}>{t("errors.retry")}</Button>
      </div>
    </Card>
  );
}
