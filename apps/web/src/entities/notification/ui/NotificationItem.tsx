import type { NotificationsListDtoItemsItem } from "@packages/api";
import { Typography } from "@packages/ui";

import { formatRelativeTime } from "@/shared/lib";

type NotificationItemProps = {
  notification: NotificationsListDtoItemsItem;
  onClick?: () => void;
  disabled?: boolean;
};

export const NotificationItem = ({
  notification,
  onClick,
  disabled,
}: NotificationItemProps) => {
  const { title, message, readAt, createdAt } = notification;

  const isUnread = readAt === null;

  const content = (
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

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-w-0 flex-1 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 [&>div]:border-b-0"
    >
      {content}
    </button>
  ) : (
    content
  );
};
