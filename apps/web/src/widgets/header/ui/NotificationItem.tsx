import type { NotificationsListDtoItemsItem } from "@packages/api";
import { Typography } from "@packages/ui";

import { formatRelativeTime } from "../lib/formatRelativeTime";

type NotificationItemProps = {
  notification: NotificationsListDtoItemsItem;
};

export const NotificationItem = ({ notification }: NotificationItemProps) => {
  const { title, message, readAt, createdAt } = notification;

  const isUnread = readAt === null;

  return (
    <div className="border-b border-border px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Typography.Small>{title}</Typography.Small>

          {isUnread && (
            <span
              className="size-2 shrink-0 rounded-full bg-primary"
              aria-hidden="true"
            />
          )}
        </div>

        <Typography.Muted className="shrink-0 text-xs">
          {formatRelativeTime(createdAt)}
        </Typography.Muted>
      </div>

      <Typography.Muted className="mt-1">{message}</Typography.Muted>
    </div>
  );
};
