"use client";

import { BellIcon } from "@packages/icons";
import { Button, Typography } from "@packages/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CAMPAIGN_CATEGORY_ICONS,
  CAMPAIGN_CATEGORY_LABEL_KEYS,
} from "../model/constants";
import type { CampaignNotificationContent } from "../model/types";

export interface NotificationLivePreviewProps {
  notification: CampaignNotificationContent;
}

export function NotificationLivePreview({
  notification,
}: NotificationLivePreviewProps) {
  const { t } = useTranslation("common");
  const [isBellOpen, setIsBellOpen] = useState(true);
  const [isToastVisible, setIsToastVisible] = useState(true);

  const categoryKey = CAMPAIGN_CATEGORY_LABEL_KEYS[notification.category];
  const CategoryIcon = CAMPAIGN_CATEGORY_ICONS[notification.category];
  const categoryLabel = t(categoryKey);
  const justNow = t("adminNotifications.preview.justNow");

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <article className="rounded-lg border border-border bg-card p-4">
        <Typography.P className="mb-3 text-xs font-medium text-muted-foreground">
          {t("adminNotifications.preview.notificationCard")}
        </Typography.P>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("adminNotifications.preview.toggleBell")}
            aria-expanded={isBellOpen}
            onClick={() => setIsBellOpen((open) => !open)}
            className="relative text-foreground"
          >
            <BellIcon aria-hidden="true" className="size-5" />
            <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-primary" />
          </Button>
        </div>

        {isBellOpen && (
          <div className="mt-3 rounded-md border border-border bg-background p-3">
            <div className="flex items-start gap-3">
              <CategoryIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {notification.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {justNow}
                  </span>
                </div>

                <Typography.P className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {notification.message}
                </Typography.P>

                <span className="mt-3 inline-flex rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {categoryLabel}
                </span>

                {notification.actionUrl && (
                  <Typography.P className="mt-2 break-all text-xs text-primary">
                    {notification.actionUrl}
                  </Typography.P>
                )}
              </div>
            </div>
          </div>
        )}
      </article>

      <article className="rounded-lg border border-border bg-background p-4 shadow-md">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Typography.P className="text-xs font-medium text-muted-foreground">
            {t("adminNotifications.preview.browserToast")}
          </Typography.P>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsToastVisible((visible) => !visible)}
            aria-pressed={isToastVisible}
            className="text-foreground"
          >
            {isToastVisible
              ? t("adminNotifications.preview.hideToast")
              : t("adminNotifications.preview.showToast")}
          </Button>
        </div>

        {isToastVisible && (
          <div className="rounded-md border border-border bg-card p-3 shadow-sm">
            <div className="flex items-start gap-3">
              <CategoryIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />

              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <span className="truncate text-sm font-semibold">
                    {notification.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {justNow}
                  </span>
                </div>

                <Typography.P className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {notification.message}
                </Typography.P>

                <Typography.P className="mt-2 text-xs text-muted-foreground">
                  {categoryLabel}
                </Typography.P>

                {notification.actionUrl && (
                  <Typography.P className="mt-1 break-all text-xs text-primary">
                    {notification.actionUrl}
                  </Typography.P>
                )}
              </div>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
