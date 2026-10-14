"use client";

import {
  NotificationCampaignDtoStatus,
  NotificationCampaignDtoTargetType,
  type NotificationCampaignsControllerFindAllSortOrder,
  type NotificationCampaignsControllerFindAllStatus,
  type NotificationCampaignsControllerFindAllTargetType,
} from "@packages/api";
import { Input, Select } from "@packages/ui";
import { useTranslation } from "react-i18next";
import { CAMPAIGN_STATUS_PRESENTATION } from "@/entities/admin-notification-campaign";
import type { PickerUser } from "@/features/admin-user-multi-picker";
import { UserMultiSelectPicker } from "@/features/admin-user-multi-picker";

interface AdminNotificationsFiltersProps {
  search: string;
  status?: NotificationCampaignsControllerFindAllStatus;
  targetType?: NotificationCampaignsControllerFindAllTargetType;
  recipientUser: PickerUser | null;
  sortOrder: NotificationCampaignsControllerFindAllSortOrder;
  onSearchChange: (value: string) => void;
  onStatusChange: (
    value?: NotificationCampaignsControllerFindAllStatus,
  ) => void;
  onTargetTypeChange: (
    value?: NotificationCampaignsControllerFindAllTargetType,
  ) => void;
  onRecipientUserChange: (user: PickerUser | null) => void;
  onSortOrderChange: (
    value: NotificationCampaignsControllerFindAllSortOrder,
  ) => void;
}

export function AdminNotificationsFilters({
  search,
  status,
  targetType,
  recipientUser,
  sortOrder,
  onSearchChange,
  onStatusChange,
  onTargetTypeChange,
  onRecipientUserChange,
  onSortOrderChange,
}: AdminNotificationsFiltersProps) {
  const { t } = useTranslation("common");

  return (
    <section
      className="flex flex-wrap gap-3 lg:flex-nowrap"
      aria-label={t("adminNotifications.filters.label")}
    >
      <Input
        className="w-full min-w-0 lg:max-w-none lg:flex-1"
        value={search}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          onSearchChange(event.target.value)
        }
        placeholder={t("adminNotifications.filters.search")}
        aria-label={t("adminNotifications.filters.search")}
      />
      <Select
        value={status ?? "all"}
        onValueChange={(value) =>
          onStatusChange(
            value === "all"
              ? undefined
              : (value as NotificationCampaignsControllerFindAllStatus),
          )
        }
      >
        <Select.Trigger className="h-[46px] w-full min-w-0 lg:max-w-none lg:flex-1">
          <Select.Value placeholder={t("adminNotifications.filters.status")} />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="all">
            {t("adminNotifications.filters.allStatuses")}
          </Select.Item>
          {Object.values(NotificationCampaignDtoStatus).map((value) => (
            <Select.Item key={value} value={value}>
              {t(CAMPAIGN_STATUS_PRESENTATION[value].labelKey)}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
      <Select
        value={targetType ?? "all"}
        onValueChange={(value) =>
          onTargetTypeChange(
            value === "all"
              ? undefined
              : (value as NotificationCampaignsControllerFindAllTargetType),
          )
        }
      >
        <Select.Trigger className="h-[46px] w-full min-w-0 lg:max-w-none lg:flex-1">
          <Select.Value placeholder={t("adminNotifications.filters.target")} />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="all">
            {t("adminNotifications.filters.allTargets")}
          </Select.Item>
          {Object.values(NotificationCampaignDtoTargetType).map((value) => (
            <Select.Item key={value} value={value}>
              {value === NotificationCampaignDtoTargetType.ALL
                ? t("adminNotifications.target.all")
                : t("adminNotifications.target.specificAudience")}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
      {targetType === NotificationCampaignDtoTargetType.SPECIFIC && (
        <UserMultiSelectPicker
          value={recipientUser ? [recipientUser] : []}
          onChange={(users) => onRecipientUserChange(users[0] ?? null)}
          maxSelected={1}
          showBulkInput={false}
          hideLabel
          hideSelectedCount
          className="w-full min-w-0 lg:max-w-none lg:flex-1"
          placeholder={t("adminNotifications.filters.recipientSearch")}
        />
      )}
      <Select
        value={sortOrder}
        onValueChange={(value) =>
          onSortOrderChange(
            value as NotificationCampaignsControllerFindAllSortOrder,
          )
        }
      >
        <Select.Trigger
          className="h-[46px] w-full min-w-0 lg:max-w-none lg:flex-1"
          aria-label={t("adminNotifications.filters.sortOrder")}
        >
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="asc">
            {t("adminNotifications.filters.ascending")}
          </Select.Item>
          <Select.Item value="desc">
            {t("adminNotifications.filters.descending")}
          </Select.Item>
        </Select.Content>
      </Select>
    </section>
  );
}
