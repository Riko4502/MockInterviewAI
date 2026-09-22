"use client";

import { ChevronRightIcon, LogOutIcon, UserIcon } from "@packages/icons";
import { DropdownMenu, Skeleton, Sidebar as UiSidebar } from "@packages/ui";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { UserAvatar, useCurrentUser } from "@/entities/user";
import { useLogout } from "@/features/auth";
import { paths } from "@/shared/config";

export function NavUser() {
  const { t } = useTranslation("common");
  const { data: user, isLoading } = useCurrentUser();
  const { logout, isPending } = useLogout();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-2">
        <Skeleton className="size-8 rounded-full" />
        <div className="grid flex-1 gap-1 group-data-[collapsible=icon]:hidden">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  const displayName =
    user?.displayName?.trim() || user?.email || t("navigation.profile");
  const email = user?.email ?? "";

  return (
    <UiSidebar.Menu>
      <UiSidebar.MenuItem>
        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <UiSidebar.MenuButton
              size="lg"
              tooltip={displayName}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <UserAvatar
                src={user?.avatarUrl}
                name={user?.displayName}
                email={user?.email}
                size="sm"
              />
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                {email ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {email}
                  </span>
                ) : null}
              </div>
              <ChevronRightIcon className="ml-auto size-4 rotate-90" />
            </UiSidebar.MenuButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            className="w-56"
            side="top"
            align="end"
            sideOffset={8}
          >
            <DropdownMenu.Item asChild>
              <Link href={paths.profile}>
                <UserIcon />
                {t("navigation.profile")}
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              variant="destructive"
              disabled={isPending}
              onSelect={() => logout()}
            >
              <LogOutIcon />
              {t("navigation.logout")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </UiSidebar.MenuItem>
    </UiSidebar.Menu>
  );
}
