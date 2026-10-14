"use client";

import {
  EditIcon,
  EyeIcon,
  MoreHorizontalIcon,
  RedoIcon,
} from "@packages/icons";
import { Button, DropdownMenu } from "@packages/ui";
import { useTranslation } from "react-i18next";
import type { AdminUser } from "@/entities/admin-user";
import { useSession } from "@/entities/session";

export type AdminUserActionType =
  | "details"
  | "edit"
  | "status"
  | "resetPassword";

export interface AdminUsersTableRowActionsProps {
  user: AdminUser;
  onAction: (type: AdminUserActionType, user: AdminUser) => void;
}

export function AdminUsersTableRowActions({
  user,
  onAction,
}: AdminUsersTableRowActionsProps) {
  const { t } = useTranslation("common");
  const session = useSession({ optional: true });

  const isSelf = Boolean(session?.userId && session.userId === user.id);
  const isDeactivatingBlocked = isSelf && user.isActive;

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 p-0"
          data-testid={`user-actions-btn-${user.id}`}
        >
          <MoreHorizontalIcon className="size-4" />
          <span className="sr-only">{t("admin.users.columns.actions")}</span>
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="w-48">
        <DropdownMenu.Item
          onSelect={() => onAction("details", user)}
          data-testid="action-details"
        >
          <EyeIcon className="size-4 mr-2" />
          {t("admin.users.actions.details")}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={() => onAction("edit", user)}
          data-testid="action-edit"
        >
          <EditIcon className="size-4 mr-2" />
          {t("admin.users.actions.edit")}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={() => onAction("resetPassword", user)}
          data-testid="action-reset-password"
        >
          <RedoIcon className="size-4 mr-2" />
          {t("admin.users.actions.resetPassword")}
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          variant={user.isActive ? "destructive" : "default"}
          disabled={isDeactivatingBlocked}
          onSelect={() => onAction("status", user)}
          data-testid="action-toggle-status"
          title={
            isDeactivatingBlocked
              ? t("admin.users.selfProtection.cannotDeactivateSelf")
              : undefined
          }
        >
          {user.isActive
            ? t("admin.users.actions.deactivate")
            : t("admin.users.actions.activate")}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
