"use client";

import { useToast } from "@packages/ui";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { subscribeToForbidden } from "@/shared/api";
import "@/shared/lib/i18n";

export function ApiErrorNotifications() {
  const { push } = useToast();
  const { t } = useTranslation("common");

  useEffect(
    () =>
      subscribeToForbidden(() => {
        push({
          id: "api-forbidden",
          status: "warning",
          title: t("errors.forbiddenTitle"),
          description: t("errors.forbiddenDescription"),
        });
      }),
    [push, t],
  );

  return null;
}
