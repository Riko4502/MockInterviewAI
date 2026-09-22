"use client";

import { BellIcon } from "@packages/icons";
import { Badge, Button, Empty, Popover, Typography } from "@packages/ui";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import {
  NotificationItem,
  useMarkAllAsReadMutation,
  useNotificationsQuery,
  useUnreadCountQuery,
} from "@/entities/notification";

import { BrowserNotificationControl } from "@/features/notification-realtime";

const NOTIFICATIONS_PREVIEW_LIMIT = 5;

export const NotificationBell = () => {
  const { t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);

  const {
    data: notificationsData,
    isPending,
    isError,
  } = useNotificationsQuery({
    page: 1,
    limit: NOTIFICATIONS_PREVIEW_LIMIT,
    enabled: isOpen,
  });
  const { data: unreadCountData } = useUnreadCountQuery();
  const { mutate: markAllAsRead, isPending: isMarkingAllAsRead } =
    useMarkAllAsReadMutation();

  const notifications = notificationsData?.items ?? [];
  const unreadCount = unreadCountData?.count ?? 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="relative"
          aria-label={
            unreadCount > 0
              ? t("notifications.unreadAria", { count: unreadCount })
              : t("navigation.notifications")
          }
        >
          <BellIcon size="sm" />

          {unreadCount > 0 && (
            <Badge
              variant="statusDanger"
              className="absolute -right-2 top-0 h-4 min-w-4 px-1 py-0 text-[10px] leading-none"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </Popover.Trigger>

      <Popover.Content align="end" sideOffset={8} className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <Typography as="h2" variant="small">
            {t("navigation.notifications")}
          </Typography>

          <Button
            type="button"
            variant="link"
            size="sm"
            disabled={unreadCount === 0 || isMarkingAllAsRead}
            onClick={() => markAllAsRead()}
          >
            {t("notifications.markAllAsRead")}
          </Button>
        </div>

        <BrowserNotificationControl />

        <div>
          {isPending ? (
            <output className="block px-4 py-6 text-center">
              <Typography.Muted>{t("notifications.loading")}</Typography.Muted>
            </output>
          ) : isError ? (
            <div role="alert" className="px-4 py-6 text-center">
              <Typography.Muted>
                {t("notifications.loadError")}
              </Typography.Muted>
            </div>
          ) : notifications.length > 0 ? (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
              />
            ))
          ) : (
            <Empty title={t("notifications.empty")} media={<BellIcon />} />
          )}
        </div>

        <div className="border-t border-border p-2">
          <Button asChild variant="ghost" className="w-full">
            <Link
              href="/dashboard/notifications"
              onClick={() => setIsOpen(false)}
            >
              {t("notifications.viewAll")}
            </Link>
          </Button>
        </div>
      </Popover.Content>
    </Popover>
  );
};
