import { Typography } from "@packages/ui";
import { NotificationsList } from "@/widgets/notifications";

export default function NotificationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Typography as="h1" variant="h2">
        Уведомления
      </Typography>
      <NotificationsList />
    </div>
  );
}
