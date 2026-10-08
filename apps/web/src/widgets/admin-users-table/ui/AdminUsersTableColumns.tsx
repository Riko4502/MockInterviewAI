"use client";

import type { DataTableColumn } from "@packages/ui";
import {
  type AdminUser,
  UserAvatarCell,
  UserRoleBadge,
  UserStatusBadge,
} from "@/entities/admin-user";
import {
  type AdminUserActionType,
  AdminUsersTableRowActions,
} from "./AdminUsersTableRowActions";

export function formatAdminDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function createAdminUsersColumns(
  t: (key: string) => string,
  onAction: (type: AdminUserActionType, user: AdminUser) => void,
): DataTableColumn<AdminUser>[] {
  return [
    {
      key: "username",
      header: t("admin.users.columns.user"),
      sortable: true,
      cell: (row) => (
        <UserAvatarCell
          avatarUrl={row.avatarUrl}
          displayName={row.displayName}
          username={row.username}
          email={row.email}
        />
      ),
    },
    {
      key: "email",
      header: t("admin.users.columns.email"),
      sortable: true,
      cell: (row) => (
        <span className="font-mono text-xs text-foreground truncate select-all">
          {row.email}
        </span>
      ),
    },
    {
      key: "role",
      header: t("admin.users.columns.role"),
      sortable: true,
      cell: (row) => <UserRoleBadge role={row.role} />,
    },
    {
      key: "status",
      header: t("admin.users.columns.status"),
      sortable: false,
      cell: (row) => <UserStatusBadge isActive={row.isActive} />,
    },
    {
      key: "createdAt",
      header: t("admin.users.columns.createdAt"),
      sortable: true,
      cell: (row) => (
        <span
          suppressHydrationWarning
          className="text-xs text-muted-foreground whitespace-nowrap"
        >
          {formatAdminDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("admin.users.columns.actions"),
      sortable: false,
      cell: (row) => (
        <div className="flex justify-end">
          <AdminUsersTableRowActions user={row} onAction={onAction} />
        </div>
      ),
    },
  ];
}
