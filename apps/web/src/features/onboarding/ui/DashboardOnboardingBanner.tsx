"use client";

import {
  getProfileControllerGetMyProfileQueryKey,
  useProfileControllerCompleteOnboarding,
} from "@packages/api";
import { ArrowRightIcon, CloseIcon, WandIcon } from "@packages/icons";
import { Button, Card } from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/entities/user";
import { paths } from "@/shared/config";

export function DashboardOnboardingBanner() {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const { data: user, isLoading, isSuccess } = useCurrentUser();
  const completeMutation = useProfileControllerCompleteOnboarding();
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  if (isLoading || !isSuccess || user?.onboardingCompleted || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    completeMutation.mutate(
      {
        data: {
          isSkipped: true,
          companies: [],
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: getProfileControllerGetMyProfileQueryKey(),
          });
        },
      },
    );
  };

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-card p-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 pr-8">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/30">
            <WandIcon className="size-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground">
              {t("onboarding.step3.previewTitle")}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-xl">
              {t("onboarding.step1.subtitle")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
          <Button asChild size="sm" variant="default" className="gap-1.5">
            <NextLink href={paths.onboarding}>
              <span>{t("actions.continue")}</span>
              <ArrowRightIcon className="size-3.5" />
            </NextLink>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleDismiss}
            aria-label={t("actions.cancel")}
            className="text-muted-foreground hover:text-foreground"
          >
            <CloseIcon className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
