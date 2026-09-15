"use client";

import { BellIcon } from "@packages/icons";
import { Badge, Button, Popover, Typography } from "@packages/ui";
import Link from "next/link";
import { useState } from "react";
import {
  NotificationItem,
  useMarkAllAsReadMutation,
  useNotificationsQuery,
  useUnreadCountQuery,
} from "@/entities/notification";

export const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);

  const { data: notificationsData } = useNotificationsQuery(isOpen);
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
              ? `Уведомления: ${unreadCount} непрочитанных`
              : "Уведомления"
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
            Уведомления
          </Typography>

          <Button
            type="button"
            variant="link"
            size="sm"
            disabled={unreadCount === 0 || isMarkingAllAsRead}
            onClick={() => markAllAsRead()}
          >
            Прочитать все
          </Button>
        </div>

        <div>
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
              />
            ))
          ) : (
            <div className="px-4 py-6 text-center">
              <Typography.Muted>У вас пока нет уведомлений</Typography.Muted>
            </div>
          )}
        </div>

        <div className="border-t border-border p-2">
          <Button asChild variant="ghost" className="w-full">
            <Link href="/notifications">Посмотреть все уведомления</Link>
          </Button>
        </div>
      </Popover.Content>
    </Popover>
  );
};
