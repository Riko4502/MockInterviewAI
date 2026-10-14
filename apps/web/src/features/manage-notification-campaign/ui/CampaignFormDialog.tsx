"use client";

import { Button, Dialog, Field, Typography } from "@packages/ui";
import { NotificationLivePreview } from "@/entities/admin-notification-campaign";
import { useCampaignFormDialog } from "../model/useCampaignFormDialog";
import {
  CampaignAudienceFields,
  CampaignDetailsFields,
  CampaignScheduleFields,
} from "./CampaignFormFields";

export interface CampaignFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  campaignId?: string;
  onSuccess: () => void;
}

export function CampaignFormDialog(props: CampaignFormDialogProps) {
  const { open, onOpenChange, mode } = props;
  const campaign = useCampaignFormDialog(props);

  const {
    t,
    language,
    form,
    errors,
    updateForm,
    submit,
    isSaving,
    isRestoringRecipients,
    recipientRestoreFailed,
    estimate,
    isAllTarget,
    isLoadingDetail,
    isDetailError,
  } = campaign;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <Dialog.Header>
          <Dialog.Title>
            {t(
              mode === "create"
                ? "adminNotifications.form.createTitle"
                : "adminNotifications.form.editTitle",
            )}
          </Dialog.Title>
          <Dialog.Description>
            {t("adminNotifications.form.description")}
          </Dialog.Description>
        </Dialog.Header>

        {isLoadingDetail ? (
          <Typography.P role="status">{t("actions.loading")}</Typography.P>
        ) : isDetailError ? (
          <Typography.P role="alert">
            {t("adminNotifications.loadError")}
          </Typography.P>
        ) : (
          <div className="grid gap-4">
            <CampaignDetailsFields form={form} updateForm={updateForm} t={t} />
            <CampaignAudienceFields
              form={form}
              updateForm={updateForm}
              isRestoringRecipients={isRestoringRecipients}
              recipientRestoreFailed={recipientRestoreFailed}
              isAllTarget={isAllTarget}
              estimate={estimate}
              t={t}
            />
            <CampaignScheduleFields
              form={form}
              updateForm={updateForm}
              mode={mode}
              language={language}
              t={t}
            />
            {errors.length > 0 && (
              <Field.Error>
                {errors.map((error) => (
                  <Typography.P key={error}>{error}</Typography.P>
                ))}
              </Field.Error>
            )}
            <NotificationLivePreview
              notification={{
                title: form.title,
                message: form.message,
                category: form.category,
                actionUrl: form.url || null,
              }}
            />
          </div>
        )}

        <Dialog.Footer className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={
              isSaving || isRestoringRecipients || recipientRestoreFailed
            }
            onClick={() => void submit("DRAFT")}
          >
            {t("adminNotifications.form.saveDraft")}
          </Button>
          <Button
            variant="outline"
            disabled={
              isSaving || isRestoringRecipients || recipientRestoreFailed
            }
            onClick={() =>
              void submit(
                "SCHEDULED",
                mode === "create" && form.scheduleMode === "NOW",
              )
            }
          >
            {t(
              mode === "create" && form.scheduleMode === "NOW"
                ? "adminNotifications.form.sendNow"
                : "adminNotifications.form.schedule",
            )}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
