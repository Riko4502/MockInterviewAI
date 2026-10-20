import {
  getNotificationCampaignsControllerFindAllQueryKey,
  getNotificationCampaignsControllerFindOneQueryKey,
  NotificationCampaignDtoTargetType,
  type NotificationCampaignsControllerCreateBody,
  type NotificationCampaignsControllerUpdateBody,
  useNotificationCampaignsControllerUpdate,
} from "@packages/api";
import { useToast } from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useCallback } from "react";
import type { CampaignFormState } from "./campaignFormState";
import { useCreateCampaignForm } from "./useCreateCampaignForm";
import { useCreateCampaignMutation } from "./useCreateCampaignMutation";

type UseCampaignFormSubmissionOptions = {
  form: CampaignFormState;
  mode: "create" | "edit";
  campaignId?: string;
  isRestoringRecipients: boolean;
  recipientRestoreFailed: boolean;
  t: TFunction<"common">;
  onSuccess: () => void;
  onErrorsChange: (errors: string[]) => void;
  onCreateReset: () => void;
};

export function useCampaignFormSubmission({
  form,
  mode,
  campaignId,
  isRestoringRecipients,
  recipientRestoreFailed,
  t,
  onSuccess,
  onErrorsChange,
  onCreateReset,
}: UseCampaignFormSubmissionOptions) {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const validateCampaign = useCreateCampaignForm();
  const create = useCreateCampaignMutation();
  const update = useNotificationCampaignsControllerUpdate();

  const submit = useCallback(
    async (sendMode: "DRAFT" | "SCHEDULED", now = false) => {
      const validationErrors = validateCampaign({
        title: form.title,
        message: form.message,
        actionUrl: form.url,
        target: form.target,
        recipientCount: form.users.length,
        sendMode,
        sendNow: now,
        scheduledAt: form.at,
      }).map((key) =>
        String(t(`adminNotifications.validation.${String(key)}` as never)),
      );

      if (
        form.target === NotificationCampaignDtoTargetType.SPECIFIC &&
        (isRestoringRecipients || recipientRestoreFailed)
      ) {
        validationErrors.push(
          t("adminNotifications.form.recipientRestoreError"),
        );
      }
      onErrorsChange(validationErrors);
      if (validationErrors.length) return;

      try {
        if (mode === "create") {
          const data: NotificationCampaignsControllerCreateBody = {
            title: form.title.trim(),
            message: form.message.trim(),
            category: form.category,
            actionUrl: form.url || undefined,
            targetType: form.target,
            recipientUserIds:
              form.target === NotificationCampaignDtoTargetType.SPECIFIC
                ? [...new Set(form.users.map((user) => user.id))]
                : undefined,
            sendMode,
            scheduledAt:
              sendMode === "SCHEDULED"
                ? now
                  ? new Date(Date.now() + 5000).toISOString()
                  : new Date(form.at).toISOString()
                : undefined,
          };
          await create.mutateAsync({ data });
        } else if (campaignId) {
          const data: NotificationCampaignsControllerUpdateBody = {
            title: form.title.trim(),
            message: form.message.trim(),
            category: form.category,
            actionUrl: form.url || null,
            targetType: form.target,
            recipientUserIds:
              form.target === NotificationCampaignDtoTargetType.SPECIFIC
                ? [...new Set(form.users.map((user) => user.id))]
                : [],
            ...(form.at
              ? { scheduledAt: new Date(form.at).toISOString() }
              : {}),
          };
          await update.mutateAsync({ id: campaignId, data });
        }

        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getNotificationCampaignsControllerFindAllQueryKey(),
          }),
          campaignId
            ? queryClient.invalidateQueries({
                queryKey:
                  getNotificationCampaignsControllerFindOneQueryKey(campaignId),
              })
            : Promise.resolve(),
        ]);
        push({
          status: "success",
          title: t(
            mode === "create"
              ? "adminNotifications.toast.created"
              : "adminNotifications.toast.updated",
          ),
        });
        if (mode === "create") {
          onCreateReset();
          create.reset();
        }
        onSuccess();
      } catch {
        push({ status: "error", title: t("adminNotifications.toast.error") });
      }
    },
    [
      campaignId,
      create,
      form,
      isRestoringRecipients,
      mode,
      onCreateReset,
      onErrorsChange,
      onSuccess,
      push,
      queryClient,
      recipientRestoreFailed,
      t,
      update,
      validateCampaign,
    ],
  );

  return { submit, isSaving: create.isPending || update.isPending };
}
