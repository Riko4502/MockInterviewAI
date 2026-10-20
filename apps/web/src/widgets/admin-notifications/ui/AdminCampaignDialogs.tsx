"use client";

import type { NotificationCampaignDetailsDto } from "@packages/api";
import { Button, Dialog, Spin, Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";
import {
  CAMPAIGN_CATEGORY_LABEL_KEYS,
  CampaignStatsCard,
  CampaignStatusBadge,
  CampaignTargetBadge,
} from "@/entities/admin-notification-campaign";

export interface CampaignConfirmation {
  id: string;
  action: "cancel" | "delete";
}

interface AdminCampaignDialogsProps {
  campaign?: NotificationCampaignDetailsDto;
  detailsLoading: boolean;
  detailsError: boolean;
  viewing: boolean;
  confirmation?: CampaignConfirmation;
  confirmationPending: boolean;
  onViewingChange: (open: boolean) => void;
  onConfirmationChange: (confirmation?: CampaignConfirmation) => void;
  onConfirm: () => void;
}

export function AdminCampaignDialogs({
  campaign,
  detailsLoading,
  detailsError,
  viewing,
  confirmation,
  confirmationPending,
  onViewingChange,
  onConfirmationChange,
  onConfirm,
}: AdminCampaignDialogsProps) {
  const { t } = useTranslation("common");

  return (
    <>
      <Dialog open={viewing} onOpenChange={onViewingChange}>
        <Dialog.Content className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <Dialog.Header>
            <Dialog.Title>
              {campaign?.title ?? t("adminNotifications.details.title")}
            </Dialog.Title>
            <Dialog.Description>
              {t("adminNotifications.details.description")}
            </Dialog.Description>
          </Dialog.Header>
          {detailsLoading ? (
            <div className="flex justify-center p-8">
              <Spin />
            </div>
          ) : detailsError ? (
            <Typography.P role="alert">
              {t("adminNotifications.loadError")}
            </Typography.P>
          ) : (
            campaign && (
              <div className="space-y-4">
                <Typography.P className="whitespace-pre-wrap">
                  {campaign.message}
                </Typography.P>
                <Typography.P>
                  {t(CAMPAIGN_CATEGORY_LABEL_KEYS[campaign.category])}
                </Typography.P>
                {campaign.actionUrl && (
                  <a
                    className="break-all text-primary underline"
                    href={campaign.actionUrl}
                  >
                    {campaign.actionUrl}
                  </a>
                )}
                <CampaignStatusBadge
                  status={campaign.status}
                  sentCount={campaign.sentCount}
                  totalRecipients={campaign.totalRecipients}
                />
                <CampaignTargetBadge
                  targetType={campaign.targetType}
                  totalRecipients={campaign.totalRecipients}
                />
                <CampaignStatsCard
                  stats={{
                    totalRecipients: campaign.totalRecipients,
                    sentCount: campaign.sentCount,
                    readCount: campaign.readCount,
                  }}
                />
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  {(
                    [
                      "scheduledAt",
                      "sentAt",
                      "completedAt",
                      "createdAt",
                      "cancelledAt",
                    ] as const
                  ).map((key) => (
                    <div key={key}>
                      <dt className="font-medium">
                        {t(`adminNotifications.details.${key}`)}
                      </dt>
                      <dd>
                        {campaign[key]
                          ? new Date(campaign[key] as string).toLocaleString()
                          : "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
                {campaign.creator && (
                  <Typography.P>
                    {t("adminNotifications.details.creator")}:{" "}
                    {campaign.creator.displayName ?? campaign.creator.email}
                  </Typography.P>
                )}
                {campaign.failureReason && (
                  <Typography.P role="alert" className="text-destructive">
                    {campaign.failureReason}
                  </Typography.P>
                )}
                {campaign.cancellationReason && (
                  <Typography.P>{campaign.cancellationReason}</Typography.P>
                )}
              </div>
            )
          )}
        </Dialog.Content>
      </Dialog>
      <Dialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open) onConfirmationChange(undefined);
        }}
      >
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>
              {t(
                confirmation?.action === "delete"
                  ? "adminNotifications.confirm.deleteTitle"
                  : "adminNotifications.confirm.cancelTitle",
              )}
            </Dialog.Title>
            <Dialog.Description>
              {t(
                confirmation?.action === "delete"
                  ? "adminNotifications.confirm.deleteDescription"
                  : "adminNotifications.confirm.cancelDescription",
              )}
            </Dialog.Description>
          </Dialog.Header>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onConfirmationChange()}>
              {t("actions.cancel")}
            </Button>
            <Button
              variant={
                confirmation?.action === "delete" ? "destructive" : "default"
              }
              disabled={confirmationPending}
              onClick={onConfirm}
            >
              {t(
                confirmation?.action === "delete"
                  ? "actions.delete"
                  : "actions.submit",
              )}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog>
    </>
  );
}
