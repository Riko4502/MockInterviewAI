import type {
  NotificationCampaignDto,
  NotificationCampaignDtoCategory,
  NotificationCampaignDtoStatus,
  NotificationCampaignDtoTargetType,
  NotificationsListDtoItemsItem,
} from "@packages/api";

export type CampaignStatus = NotificationCampaignDtoStatus;
export type CampaignTargetType = NotificationCampaignDtoTargetType;
export type CampaignNotificationCategory = NotificationCampaignDtoCategory;
export type AdminNotificationCampaign = NotificationCampaignDto;
export type CampaignNotificationContent = Pick<
  NotificationsListDtoItemsItem,
  "title" | "message" | "category" | "actionUrl"
>;
export type AdminNotificationCampaignContent = CampaignNotificationContent;
export type CampaignStats = Pick<
  NotificationCampaignDto,
  "totalRecipients" | "sentCount" | "readCount"
>;
