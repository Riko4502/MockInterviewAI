"use client";
import { Badge, Progress } from "@packages/ui";
import { useTranslation } from "react-i18next";
import { CAMPAIGN_STATUS_PRESENTATION } from "../model/constants";
import type { CampaignStatus } from "../model/types";

export interface CampaignStatusBadgeProps {
  status: CampaignStatus;
  sentCount?: number;
  totalRecipients?: number;
}

export function CampaignStatusBadge({
  status,
  sentCount = 0,
  totalRecipients = 0,
}: CampaignStatusBadgeProps) {
  const { t } = useTranslation("common");

  const presentation = CAMPAIGN_STATUS_PRESENTATION[status];

  const percentage =
    totalRecipients > 0
      ? Math.min(100, Math.round((sentCount / totalRecipients) * 100))
      : 0;

  return (
    <span className="inline-flex min-w-24 flex-col items-start gap-1">
      <Badge variant={presentation.badgeVariant}>
        {t(presentation.labelKey)}
      </Badge>
      {presentation.showProgress && (
        <span className="flex w-full items-center gap-2">
          <Progress value={percentage} className="w-16" />
          <span className="text-xs text-muted-foreground">
            {t("adminNotifications.progress", {
              sent: sentCount,
              total: totalRecipients,
              percentage,
            })}
          </span>
        </span>
      )}
    </span>
  );
}
