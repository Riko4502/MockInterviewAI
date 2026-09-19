"use client";

import { Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { NotificationsList } from "@/widgets/notifications";

export default function NotificationsPage() {
  const { t } = useTranslation("common");

  return (
    <div className="flex flex-col gap-6">
      <Typography as="h1" variant="h2">
        {t("navigation.notifications")}
      </Typography>
      <NotificationsList />
    </div>
  );
}
