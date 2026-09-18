"use client";

import { Button } from "@packages/ui";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";

interface InvalidTokenAlertProps {
  title?: string;
  description?: string;
}

export function InvalidTokenAlert({
  title,
  description,
}: InvalidTokenAlertProps) {
  const router = useRouter();
  const { t } = useTranslation("auth");

  const resolvedTitle = title ?? t("resetPassword.invalidToken.expiredTitle");
  const resolvedDescription =
    description ?? t("resetPassword.invalidToken.expiredDescription");

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="w-full rounded-lg border border-destructive/30 bg-destructive/10 p-4">
        <p className="text-sm font-medium text-destructive">{resolvedTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {resolvedDescription}
        </p>
      </div>

      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={() => router.push(paths.forgotPassword)}
      >
        {t("resetPassword.invalidToken.cta")}
      </Button>
    </div>
  );
}
