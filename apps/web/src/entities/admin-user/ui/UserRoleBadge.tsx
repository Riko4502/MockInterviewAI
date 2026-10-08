"use client";

import { SystemRole } from "@packages/types";
import { Badge } from "@packages/ui";
import { cn } from "@packages/utils";
import { useTranslation } from "react-i18next";

export interface UserRoleBadgeProps {
  role: SystemRole | string;
  className?: string;
}

export function UserRoleBadge({ role, className }: UserRoleBadgeProps) {
  const { t } = useTranslation("common");
  const isAdmin = role === SystemRole.ADMIN;

  return (
    <Badge
      variant="tag"
      className={cn(
        "font-medium",
        isAdmin
          ? "border-purple-500/30 bg-purple-500/10 text-purple-400 dark:border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-300"
          : "border-border bg-muted/50 text-muted-foreground",
        className,
      )}
    >
      {isAdmin ? t("admin.users.roles.ADMIN") : t("admin.users.roles.USER")}
    </Badge>
  );
}
