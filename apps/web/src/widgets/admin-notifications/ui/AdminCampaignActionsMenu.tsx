"use client";

import {
  NotificationCampaignDtoStatus,
  type NotificationCampaignsPageDtoItemsItem,
} from "@packages/api";
import { MoreHorizontalIcon } from "@packages/icons";
import { Button, DropdownMenu } from "@packages/ui";
import { useTranslation } from "react-i18next";

interface AdminCampaignActionsMenuProps {
  campaign: NotificationCampaignsPageDtoItemsItem;
  queuePending: boolean;
  onEdit: (id: string) => void;
  onQueue: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}

export function AdminCampaignActionsMenu({
  campaign,
  queuePending,
  onEdit,
  onQueue,
  onCancel,
  onDelete,
}: AdminCampaignActionsMenuProps) {
  const { t } = useTranslation("common");
  const { id, status } = campaign;
  const canEdit =
    status === NotificationCampaignDtoStatus.DRAFT ||
    status === NotificationCampaignDtoStatus.SCHEDULED;
  const canQueue =
    status === NotificationCampaignDtoStatus.DRAFT ||
    status === NotificationCampaignDtoStatus.FAILED;
  const canCancel =
    status === NotificationCampaignDtoStatus.SCHEDULED ||
    status === NotificationCampaignDtoStatus.PROCESSING;
  const canDelete =
    status === NotificationCampaignDtoStatus.DRAFT ||
    status === NotificationCampaignDtoStatus.CANCELLED;

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={t("adminNotifications.table.actions")}
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        {canEdit && (
          <DropdownMenu.Item onSelect={() => onEdit(id)}>
            {t("actions.edit")}
          </DropdownMenu.Item>
        )}
        {canQueue && (
          <DropdownMenu.Item
            disabled={queuePending}
            onSelect={() => onQueue(id)}
          >
            {t("adminNotifications.actions.sendNow")}
          </DropdownMenu.Item>
        )}
        {canCancel && (
          <DropdownMenu.Item onSelect={() => onCancel(id)}>
            {t("actions.cancel")}
          </DropdownMenu.Item>
        )}
        {canDelete && (
          <DropdownMenu.Item
            variant="destructive"
            onSelect={() => onDelete(id)}
          >
            {t("actions.delete")}
          </DropdownMenu.Item>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
