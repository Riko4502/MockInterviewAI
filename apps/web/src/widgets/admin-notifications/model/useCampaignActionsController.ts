"use client";

import {
  getNotificationCampaignsControllerFindAllQueryKey,
  getNotificationCampaignsControllerFindOneQueryKey,
  useNotificationCampaignsControllerCancel,
  useNotificationCampaignsControllerQueue,
  useNotificationCampaignsControllerRemove,
} from "@packages/api";
import { useToast } from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { CampaignConfirmation } from "./types";

export function useCampaignActionsController() {
  const { t } = useTranslation("common");
  const { push } = useToast();
  const queryClient = useQueryClient();

  const refresh = async (id?: string) => {
    await queryClient.invalidateQueries({
      queryKey: getNotificationCampaignsControllerFindAllQueryKey(),
    });
    if (id) {
      await queryClient.invalidateQueries({
        queryKey: getNotificationCampaignsControllerFindOneQueryKey(id),
      });
    }
  };

  const cancel = useNotificationCampaignsControllerCancel({
    mutation: { onSuccess: (_data, variables) => void refresh(variables.id) },
  });

  const remove = useNotificationCampaignsControllerRemove({
    mutation: { onSuccess: (_data, variables) => void refresh(variables.id) },
  });

  const queue = useNotificationCampaignsControllerQueue({
    mutation: { onSuccess: (_data, variables) => void refresh(variables.id) },
  });

  const queueCampaign = async (id: string) => {
    try {
      await queue.mutateAsync({ id });
      push({ status: "success", title: t("adminNotifications.toast.queued") });
    } catch {
      push({ status: "error", title: t("adminNotifications.toast.error") });
    }
  };

  const confirm = async (confirmation?: CampaignConfirmation) => {
    if (!confirmation) return;
    try {
      if (confirmation.action === "cancel") {
        await cancel.mutateAsync({ id: confirmation.id });
        push({
          status: "success",
          title: t("adminNotifications.toast.cancelled"),
        });
      } else {
        await remove.mutateAsync({ id: confirmation.id });
        push({
          status: "success",
          title: t("adminNotifications.toast.deleted"),
        });
      }
      return true;
    } catch {
      push({ status: "error", title: t("adminNotifications.toast.error") });
      return false;
    }
  };

  return {
    queueCampaign,
    confirm,
    queuePending: queue.isPending,
    confirmationPending: cancel.isPending || remove.isPending,
  };
}
