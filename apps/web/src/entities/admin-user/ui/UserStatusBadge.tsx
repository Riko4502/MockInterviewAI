"use client";

import { Badge } from "@packages/ui";
import { cn } from "@packages/utils";
import { useTranslation } from "react-i18next";

export interface UserStatusBadgeProps {
  isActive: boolean;
  className?: string;
}

export function UserStatusBadge({ isActive, className }: UserStatusBadgeProps) {
  const { t } = useTranslation("common");

  return (
    <Badge
      variant={isActive ? "statusSuccess" : "statusDanger"}
      className={cn("font-medium", className)}
    >
      {isActive
        ? t("admin.users.statuses.active")
        : t("admin.users.statuses.deactivated")}
    </Badge>
  );
}
