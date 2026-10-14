"use client";

import type { UserProfileDto } from "@packages/api";
import { ArrowRightIcon, SlidersIcon } from "@packages/icons";
import { Button, Card } from "@packages/ui";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { paths } from "@/shared/config";

type ProfileGoalsCardProps = {
  user: UserProfileDto;
};

export function ProfileGoalsCard({ user }: ProfileGoalsCardProps) {
  const { t } = useTranslation("common");

  const hasGoals = Boolean(
    user.targetRole ||
      user.targetLevel ||
      user.targetTimeline ||
      user.preferredFormat ||
      (user.targetCompanies && user.targetCompanies.length > 0),
  );

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersIcon className="size-5 text-primary" />
            <Card.Title>{t("profile.goalsTitle")}</Card.Title>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={paths.onboarding}>
              <span>
                {user.onboardingCompleted
                  ? t("profile.goalsChange")
                  : t("profile.goalsSetup")}
              </span>
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </Button>
        </div>
        <Card.Description>{t("profile.goalsSubtitle")}</Card.Description>
      </Card.Header>
      <Card.Content>
        {hasGoals ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-xl bg-card-secondary/40 border border-border/50">
              <span className="text-xs text-muted-foreground block">
                {t("profile.targetRole")}
              </span>
              <span className="text-sm font-semibold mt-1 block">
                {user.targetRole
                  ? t(`onboarding.roles.${user.targetRole}.title`, {
                      defaultValue: user.targetRole,
                    })
                  : "—"}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-card-secondary/40 border border-border/50">
              <span className="text-xs text-muted-foreground block">
                {t("profile.targetLevel")}
              </span>
              <span className="text-sm font-semibold mt-1 block">
                {user.targetLevel
                  ? t(`onboarding.levels.${user.targetLevel}.title`, {
                      defaultValue: user.targetLevel,
                    })
                  : "—"}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-card-secondary/40 border border-border/50">
              <span className="text-xs text-muted-foreground block">
                {t("profile.targetTimeline")}
              </span>
              <span className="text-sm font-semibold mt-1 block">
                {user.targetTimeline
                  ? t(`onboarding.timelines.${user.targetTimeline}`, {
                      defaultValue: user.targetTimeline,
                    })
                  : "—"}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-card-secondary/40 border border-border/50">
              <span className="text-xs text-muted-foreground block">
                {t("profile.preferredFormat")}
              </span>
              <span className="text-sm font-semibold mt-1 block">
                {user.preferredFormat
                  ? t(`onboarding.formats.${user.preferredFormat}.title`, {
                      defaultValue: user.preferredFormat,
                    })
                  : "—"}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-card-secondary/40 border border-border/50 sm:col-span-2 lg:col-span-4">
              <span className="text-xs text-muted-foreground block mb-1.5">
                {t("profile.targetCompanies")}
              </span>
              {user.targetCompanies && user.targetCompanies.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {user.targetCompanies.map((company) => (
                    <span
                      key={company}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                    >
                      {t(`onboarding.companies.${company}.title`, {
                        defaultValue: company,
                      })}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-sm font-medium text-muted-foreground">
                  —
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("profile.goalsEmpty")}
          </p>
        )}
      </Card.Content>
    </Card>
  );
}
