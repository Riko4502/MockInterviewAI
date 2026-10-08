"use client";

import { useAdminUsersControllerGetUserById } from "@packages/api";
import { Drawer, Skeleton } from "@packages/ui";
import { useTranslation } from "react-i18next";
import {
  UserAvatarCell,
  UserRoleBadge,
  UserStatusBadge,
} from "@/entities/admin-user";

export interface UserDetailsDrawerProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserDetailsDrawer({
  userId,
  open,
  onOpenChange,
}: UserDetailsDrawerProps) {
  const { t } = useTranslation("common");

  const {
    data: user,
    isLoading,
    isError,
  } = useAdminUsersControllerGetUserById(userId ?? "", {
    query: {
      enabled: Boolean(userId && open),
    },
  });

  const formatDate = (dateStr?: string | null) => {
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
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content
        side="right"
        className="w-full sm:max-w-md p-6 overflow-y-auto"
        data-testid="user-details-drawer"
      >
        <Drawer.Header className="px-0 pb-4 border-b border-border">
          <Drawer.Title className="text-lg font-semibold">
            {t("admin.users.drawer.title")}
          </Drawer.Title>
        </Drawer.Header>

        {isLoading ? (
          <div
            className="py-6 space-y-4"
            data-testid="details-loading-skeleton"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : isError || !user ? (
          <div className="py-8 text-center text-sm text-destructive">
            {t("admin.users.error.loadFailed")}
          </div>
        ) : (
          <div className="py-6 space-y-6">
            {/* User Profile Header */}
            <div className="flex flex-col gap-3">
              <UserAvatarCell
                avatarUrl={user.avatarUrl}
                displayName={user.displayName}
                username={user.username}
                email={user.email}
              />
              <div className="flex items-center gap-2 pt-1">
                <UserRoleBadge role={user.role} />
                <UserStatusBadge isActive={user.isActive} />
              </div>
            </div>

            {/* General Info */}
            <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">
                  {t("admin.users.drawer.userId")}
                </span>
                <span className="font-mono select-all truncate max-w-[200px]">
                  {user.id}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium truncate max-w-[200px]">
                  {user.email}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">
                  {t("admin.users.drawer.createdAt")}
                </span>
                <span suppressHydrationWarning className="font-medium">
                  {formatDate(user.createdAt)}
                </span>
              </div>
              {user.deactivatedAt && (
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground">
                    {t("admin.users.drawer.deactivatedAt")}
                  </span>
                  <span
                    suppressHydrationWarning
                    className="text-destructive font-medium"
                  >
                    {formatDate(user.deactivatedAt)}
                  </span>
                </div>
              )}
            </div>

            {/* Activity Statistics */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("admin.users.drawer.statsTitle")}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-border bg-card">
                  <div className="text-xs text-muted-foreground">
                    {t("admin.users.drawer.sessionsCount")}
                  </div>
                  <div className="text-xl font-bold mt-1 text-foreground">
                    {user.sessionsCount ?? 0}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-border bg-card">
                  <div className="text-xs text-muted-foreground">
                    {t("admin.users.drawer.participationsCount")}
                  </div>
                  <div className="text-xl font-bold mt-1 text-foreground">
                    {user.participationsCount ?? 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Social / External Links */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("admin.users.editModal.telegram")} /{" "}
                {t("admin.users.editModal.gitUrl")}
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1.5 px-3 rounded-md bg-muted/20 border border-border/60">
                  <span className="text-muted-foreground">
                    {t("admin.users.drawer.telegram")}
                  </span>
                  <span className="font-mono">
                    {user.telegramUsername
                      ? `@${user.telegramUsername}`
                      : t("admin.users.drawer.notSpecified")}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 px-3 rounded-md bg-muted/20 border border-border/60">
                  <span className="text-muted-foreground">
                    {t("admin.users.drawer.gitUrl")}
                  </span>
                  {user.gitUrl ? (
                    <a
                      href={user.gitUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline truncate max-w-[200px]"
                    >
                      {user.gitUrl}
                    </a>
                  ) : (
                    <span>{t("admin.users.drawer.notSpecified")}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer.Content>
    </Drawer>
  );
}
