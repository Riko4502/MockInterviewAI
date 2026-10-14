import {
  NotificationCampaignDtoTargetType,
  useNotificationCampaignsControllerEstimateRecipients,
  useNotificationCampaignsControllerFindOne,
} from "@packages/api";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PickerUser } from "@/features/admin-user-multi-picker";
import { useUserSearch } from "@/features/admin-user-multi-picker";
import {
  type CampaignFormState,
  createInitialCampaignDialogState,
} from "./campaignFormState";
import { useCampaignFormHydration } from "./useCampaignFormHydration";
import { useCampaignFormSubmission } from "./useCampaignFormSubmission";

type UseCampaignFormDialogOptions = {
  open: boolean;
  mode: "create" | "edit";
  campaignId?: string;
  onSuccess: () => void;
};

export function useCampaignFormDialog({
  open,
  mode,
  campaignId,
  onSuccess,
}: UseCampaignFormDialogOptions) {
  const { t, i18n } = useTranslation("common");
  const [state, setState] = useState(createInitialCampaignDialogState);
  const { form, errors, isRestoringRecipients, recipientRestoreFailed } = state;
  const detail = useNotificationCampaignsControllerFindOne(campaignId ?? "", {
    query: { enabled: open && mode === "edit" && Boolean(campaignId) },
  });
  const { resolveRecipientIds } = useUserSearch("", false);
  const estimate = useNotificationCampaignsControllerEstimateRecipients({
    query: {
      enabled: open && form.target === NotificationCampaignDtoTargetType.ALL,
    },
  });

  const updateForm = useCallback(
    <K extends keyof CampaignFormState>(
      key: K,
      value: CampaignFormState[K],
    ) => {
      setState((previous) => ({
        ...previous,
        form: { ...previous.form, [key]: value },
      }));
    },
    [],
  );
  const resetState = useCallback(
    () => setState(createInitialCampaignDialogState()),
    [],
  );
  const updateErrors = useCallback((nextErrors: string[]) => {
    setState((previous) => ({ ...previous, errors: nextErrors }));
  }, []);

  useCampaignFormHydration({
    open,
    mode,
    campaign: detail.data,
    resolveRecipientIds,
    setState,
  });
  const { submit, isSaving } = useCampaignFormSubmission({
    form,
    mode,
    campaignId,
    isRestoringRecipients,
    recipientRestoreFailed,
    t,
    onSuccess,
    onErrorsChange: updateErrors,
    onCreateReset: resetState,
  });

  return {
    t,
    language: i18n.language,
    form,
    errors,
    updateForm,
    submit,
    isSaving,
    isRestoringRecipients,
    recipientRestoreFailed,
    estimate,
    isSpecificTarget:
      form.target === NotificationCampaignDtoTargetType.SPECIFIC,
    isAllTarget: form.target === NotificationCampaignDtoTargetType.ALL,
    isLoadingDetail: mode === "edit" && detail.isLoading,
    isDetailError: mode === "edit" && detail.isError,
  };
}
