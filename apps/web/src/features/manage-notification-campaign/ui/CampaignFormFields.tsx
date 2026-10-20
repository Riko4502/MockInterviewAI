import {
  NotificationCampaignDtoCategory,
  NotificationCampaignDtoTargetType,
  type NotificationCampaignRecipientEstimateDto,
} from "@packages/api";
import {
  Button,
  DatePicker,
  Field,
  Input,
  RadioGroup,
  Select,
  Textarea,
  Typography,
} from "@packages/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import type { ChangeEvent } from "react";
import { CAMPAIGN_CATEGORY_LABEL_KEYS } from "@/entities/admin-notification-campaign";
import { UserMultiSelectPicker } from "@/features/admin-user-multi-picker";
import type { CampaignFormState } from "../model/campaignFormState";

type UpdateForm = <K extends keyof CampaignFormState>(
  key: K,
  value: CampaignFormState[K],
) => void;

type DetailsProps = {
  form: CampaignFormState;
  updateForm: UpdateForm;
  t: TFunction<"common">;
};

export function CampaignDetailsFields({ form, updateForm, t }: DetailsProps) {
  return (
    <>
      <Field>
        <Field.Label>{t("adminNotifications.form.title")}</Field.Label>
        <Field.Content>
          <Input
            maxLength={200}
            value={form.title}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              updateForm("title", event.target.value)
            }
          />
        </Field.Content>
      </Field>
      <Field>
        <Field.Label>{t("adminNotifications.form.category")}</Field.Label>
        <Field.Content>
          <Select
            value={form.category}
            onValueChange={(value) =>
              updateForm("category", value as NotificationCampaignDtoCategory)
            }
          >
            <Select.Trigger className="w-full">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {Object.values(NotificationCampaignDtoCategory).map((value) => (
                <Select.Item key={value} value={value}>
                  {t(CAMPAIGN_CATEGORY_LABEL_KEYS[value])}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </Field.Content>
      </Field>
      <Field>
        <Field.Label>{t("adminNotifications.form.message")}</Field.Label>
        <Field.Content>
          <Textarea
            maxLength={2000}
            value={form.message}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              updateForm("message", event.target.value)
            }
          />
        </Field.Content>
      </Field>
      <Field>
        <Field.Label>{t("adminNotifications.form.actionUrl")}</Field.Label>
        <Field.Content>
          <Input
            value={form.url}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              updateForm("url", event.target.value)
            }
          />
        </Field.Content>
      </Field>
    </>
  );
}

type AudienceProps = {
  form: CampaignFormState;
  updateForm: UpdateForm;
  isRestoringRecipients: boolean;
  recipientRestoreFailed: boolean;
  isAllTarget: boolean;
  estimate: UseQueryResult<NotificationCampaignRecipientEstimateDto, unknown>;
  t: TFunction<"common">;
};

export function CampaignAudienceFields(props: AudienceProps) {
  const {
    form,
    updateForm,
    isRestoringRecipients,
    recipientRestoreFailed,
    isAllTarget,
    estimate,
    t,
  } = props;
  const isSpecific = form.target === NotificationCampaignDtoTargetType.SPECIFIC;
  return (
    <>
      <Field>
        <Field.Label>{t("adminNotifications.form.target")}</Field.Label>
        <Field.Content>
          <RadioGroup
            value={form.target}
            onValueChange={(value) =>
              updateForm("target", value as NotificationCampaignDtoTargetType)
            }
          >
            <Field.Label className="items-center text-sm">
              <RadioGroup.Item value={NotificationCampaignDtoTargetType.ALL} />
              {t("adminNotifications.target.all")}
            </Field.Label>
            <Field.Label className="items-center text-sm">
              <RadioGroup.Item
                value={NotificationCampaignDtoTargetType.SPECIFIC}
              />
              {t("adminNotifications.target.specific", {
                count: form.users.length,
              })}
            </Field.Label>
          </RadioGroup>
        </Field.Content>
      </Field>
      {isSpecific && (
        <Field>
          <Field.Label>
            {t("adminNotifications.target.specific", {
              count: form.users.length,
            })}
          </Field.Label>
          <Field.Content>
            {isRestoringRecipients && (
              <Typography.P role="status">
                {t("adminNotifications.form.restoringRecipients")}
              </Typography.P>
            )}
            {recipientRestoreFailed && (
              <Field.Error>
                {t("adminNotifications.form.recipientRestoreError")}
              </Field.Error>
            )}
            <UserMultiSelectPicker
              value={form.users}
              onChange={(users) => updateForm("users", users)}
              disabled={isRestoringRecipients || recipientRestoreFailed}
            />
          </Field.Content>
        </Field>
      )}
      {isAllTarget && estimate.isLoading && (
        <Typography.P aria-live="polite" role="status">
          {t("actions.loading")}
        </Typography.P>
      )}
      {isAllTarget && estimate.isError && (
        <Field.Error className="flex items-center gap-2 text-sm text-destructive">
          <Typography.P>{t("adminNotifications.loadError")}</Typography.P>
          <Button variant="link" onClick={() => void estimate.refetch()}>
            {t("notifications.retry")}
          </Button>
        </Field.Error>
      )}
      {(isSpecific || estimate.data) && (
        <Typography.P aria-live="polite">
          {t("adminNotifications.form.audienceEstimate", {
            count: isAllTarget
              ? (estimate.data?.count ?? 0)
              : form.users.length,
          })}
        </Typography.P>
      )}
    </>
  );
}

type ScheduleProps = {
  form: CampaignFormState;
  updateForm: UpdateForm;
  mode: "create" | "edit";
  language: string;
  t: TFunction<"common">;
};

function formatLocalDate(date: Date): string {
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}

export function CampaignScheduleFields({
  form,
  updateForm,
  mode,
  language,
  t,
}: ScheduleProps) {
  return (
    <Field>
      <Field.Label>{t("adminNotifications.form.scheduledAt")}</Field.Label>
      {mode === "create" && (
        <Field.Set className="mb-3">
          <Field.Legend>
            {t("adminNotifications.form.timingLabel")}
          </Field.Legend>
          <RadioGroup
            value={form.scheduleMode}
            onValueChange={(value) =>
              updateForm(
                "scheduleMode",
                value as CampaignFormState["scheduleMode"],
              )
            }
          >
            <Field.Label className="items-center text-sm">
              <RadioGroup.Item value="NOW" />
              {t("adminNotifications.form.sendImmediately")}
            </Field.Label>
            <Field.Label className="items-center text-sm">
              <RadioGroup.Item value="SCHEDULED" />
              {t("adminNotifications.form.sendScheduled")}
            </Field.Label>
          </RadioGroup>
        </Field.Set>
      )}
      {(mode === "edit" || form.scheduleMode === "SCHEDULED") && (
        <Field.Content>
          <div className="grid gap-2 sm:grid-cols-2">
            <DatePicker
              value={form.at ? new Date(form.at) : null}
              minDate={new Date()}
              clearable
              placeholder={t("adminNotifications.form.chooseDate")}
              formatDate={(date) =>
                new Intl.DateTimeFormat(language).format(date)
              }
              onChange={(date) => {
                if (!date) {
                  updateForm("at", "");
                  return;
                }
                const datePart = formatLocalDate(date);
                const timePart = form.at.split("T")[1] || "09:00";
                updateForm("at", `${datePart}T${timePart}`);
              }}
            />
            <Input
              type="time"
              value={form.at.split("T")[1] ?? ""}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const datePart =
                  form.at.split("T")[0] || formatLocalDate(new Date());
                updateForm("at", `${datePart}T${event.target.value}`);
              }}
              aria-label={t("adminNotifications.form.timeLabel")}
            />
          </div>
        </Field.Content>
      )}
    </Field>
  );
}
