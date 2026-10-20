"use client";
import { Badge } from "@packages/ui";
import { useTranslation } from "react-i18next";
import type { CampaignTargetType } from "../model/types";

export interface CampaignTargetBadgeProps {
  targetType: CampaignTargetType;
  totalRecipients?: number;
}

export function CampaignTargetBadge({
  targetType,
  totalRecipients = 0,
}: CampaignTargetBadgeProps) {
  const { t } = useTranslation("common");
  const label =
    targetType === "ALL"
      ? t("adminNotifications.target.all")
      : t("adminNotifications.target.specific", { count: totalRecipients });

  return <Badge variant="tag">{label}</Badge>;
}
