"use client";

import {
  getNotificationsControllerGetNotificationsQueryKey,
  getNotificationsControllerGetUnreadCountQueryKey,
  type NotificationsListDtoItemsItem,
  useNotificationsControllerMarkAsDeleted,
  useNotificationsControllerMarkAsRead,
} from "@packages/api";
import { Button, Typography } from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { NotificationItem } from "@/entities/notification";

export const NotificationActions = ({
  notification,
}: {
  notification: NotificationsListDtoItemsItem;
}) => {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const router = useRouter();
  const invalidateNotifications = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getNotificationsControllerGetNotificationsQueryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: getNotificationsControllerGetUnreadCountQueryKey(),
      }),
    ]);
  };
  const readMutation = useNotificationsControllerMarkAsRead({
    mutation: { onSuccess: invalidateNotifications },
  });
  const deleteMutation = useNotificationsControllerMarkAsDeleted({
    mutation: { onSuccess: invalidateNotifications },
  });
  const isPending = readMutation.isPending || deleteMutation.isPending;

  const openNotification = () => {
    const navigate = () => {
      if (notification.actionUrl) {
        let url: URL;
        try {
          url = new URL(notification.actionUrl, window.location.origin);
        } catch {
          return;
        }
        if (url.protocol !== "http:" && url.protocol !== "https:") return;
        if (url.origin === window.location.origin) {
          router.push(`${url.pathname}${url.search}${url.hash}`);
        } else {
          window.location.assign(url.href);
        }
      }
    };

    if (notification.readAt === null) {
      readMutation.mutate({ id: notification.id }, { onSuccess: navigate });
    } else {
      navigate();
    }
  };

  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-2">
        <NotificationItem
          notification={notification}
          onClick={openNotification}
          disabled={isPending}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mr-4 shrink-0"
          aria-label={t("notifications.deleteAria", {
            title: notification.title,
          })}
          disabled={isPending}
          onClick={() => deleteMutation.mutate({ id: notification.id })}
        >
          {t("actions.delete")}
        </Button>
      </div>
      {(readMutation.isError || deleteMutation.isError) && (
        <Typography.Muted role="alert" className="px-4 pb-3 text-destructive">
          {t("notifications.updateError")}
        </Typography.Muted>
      )}
    </div>
  );
};
