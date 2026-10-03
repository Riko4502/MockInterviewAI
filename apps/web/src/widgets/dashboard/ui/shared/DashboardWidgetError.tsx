"use client";

import { Alert, Button } from "@packages/ui";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";

export function DashboardWidgetError({
  retry,
  busy,
}: {
  retry: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation("dashboard");
  return (
    <Alert variant="destructive">
      <Alert.Description>{t("errors.load")}</Alert.Description>
      <Button variant="outline" disabled={busy} onClick={retry}>
        {t("errors.retry")}
      </Button>
    </Alert>
  );
}
