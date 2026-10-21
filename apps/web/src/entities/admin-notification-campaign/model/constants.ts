import { BellIcon } from "@packages/icons";
import type { BadgeVariant } from "@packages/ui";
import type { CampaignNotificationCategory, CampaignStatus } from "./types";

export interface CampaignStatusPresentation {
  labelKey: `adminNotifications.status.${Lowercase<CampaignStatus>}`;
  badgeVariant: BadgeVariant;
  showProgress?: boolean;
}

export const CAMPAIGN_STATUS_PRESENTATION: Record<
  CampaignStatus,
  CampaignStatusPresentation
> = {
  DRAFT: {
    labelKey: "adminNotifications.status.draft",
    badgeVariant: "waiting",
  },
  SCHEDULED: {
    labelKey: "adminNotifications.status.scheduled",
    badgeVariant: "statusInfo",
  },
  PROCESSING: {
    labelKey: "adminNotifications.status.processing",
    badgeVariant: "statusInfo",
    showProgress: true,
  },
  COMPLETED: {
    labelKey: "adminNotifications.status.completed",
    badgeVariant: "statusSuccess",
  },
  CANCELLED: {
    labelKey: "adminNotifications.status.cancelled",
    badgeVariant: "waiting",
  },
  FAILED: {
    labelKey: "adminNotifications.status.failed",
    badgeVariant: "statusDanger",
  },
};

export const CAMPAIGN_CATEGORY_LABEL_KEYS = {
  SYSTEM: "notifications.filters.system",
  INTERVIEW: "notifications.filters.interview",
  MESSAGE: "notifications.filters.message",
} as const satisfies Record<CampaignNotificationCategory, string>;

export const CAMPAIGN_CATEGORY_ICONS = {
  SYSTEM: BellIcon,
  INTERVIEW: BellIcon,
  MESSAGE: BellIcon,
} satisfies Record<CampaignNotificationCategory, typeof BellIcon>;
