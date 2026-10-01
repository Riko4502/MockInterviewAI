"use client";

import { Button } from "@packages/ui";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";

export function AccessDenied() {
  const router = useRouter();
  const { t } = useTranslation("auth");

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="w-full rounded-lg border border-destructive/30 bg-destructive/10 p-4">
        <h2 className="text-sm font-medium text-destructive">
          {t("accessDenied.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("accessDenied.description")}
        </p>
      </div>
      <Button type="button" variant="outline" onClick={() => router.back()}>
        {t("accessDenied.back")}
      </Button>
    </div>
  );
}
