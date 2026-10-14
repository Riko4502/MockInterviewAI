import {
  type NotificationCampaignDetailsDto,
  NotificationCampaignDtoTargetType,
} from "@packages/api";
import { type Dispatch, type SetStateAction, useEffect } from "react";
import type { PickerUser } from "@/features/admin-user-multi-picker";
import {
  type CampaignDialogState,
  createInitialCampaignDialogState,
} from "./campaignFormState";

type UseCampaignFormHydrationOptions = {
  open: boolean;
  mode: "create" | "edit";
  campaign?: NotificationCampaignDetailsDto;
  resolveRecipientIds: (ids: string[]) => Promise<{
    users: PickerUser[];
    unresolved: string[];
  }>;
  setState: Dispatch<SetStateAction<CampaignDialogState>>;
};

function formatLocalDateTime(date: Date): string {
  const localDate =
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0");
  return (
    localDate +
    "T" +
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0")
  );
}

export function useCampaignFormHydration({
  open,
  mode,
  campaign,
  resolveRecipientIds,
  setState,
}: UseCampaignFormHydrationOptions) {
  useEffect(() => {
    if (!open) return;
    let active = true;
    setState((previous) => ({
      ...previous,
      errors: [],
      recipientRestoreFailed: false,
    }));

    if (mode === "create") {
      setState(createInitialCampaignDialogState());
      return () => {
        active = false;
      };
    }
    if (!campaign)
      return () => {
        active = false;
      };

    setState({
      form: {
        title: campaign.title,
        message: campaign.message,
        category: campaign.category,
        url: campaign.actionUrl ?? "",
        target: campaign.targetType,
        users: [],
        at: campaign.scheduledAt
          ? formatLocalDateTime(new Date(campaign.scheduledAt))
          : "",
        scheduleMode: "SCHEDULED",
      },
      errors: [],
      isRestoringRecipients:
        campaign.targetType === NotificationCampaignDtoTargetType.SPECIFIC,
      recipientRestoreFailed: false,
    });

    if (campaign.targetType === NotificationCampaignDtoTargetType.SPECIFIC) {
      void resolveRecipientIds(campaign.recipientUserIds)
        .then(({ users, unresolved }) => {
          if (!active) return;
          setState((previous) => ({
            ...previous,
            form: { ...previous.form, users },
            recipientRestoreFailed: unresolved.length > 0,
          }));
        })
        .catch(() => {
          if (active)
            setState((previous) => ({
              ...previous,
              recipientRestoreFailed: true,
            }));
        })
        .finally(() => {
          if (active)
            setState((previous) => ({
              ...previous,
              isRestoringRecipients: false,
            }));
        });
    }

    return () => {
      active = false;
    };
  }, [open, mode, campaign, resolveRecipientIds, setState]);
}
