"use client";

import { useIsMobile } from "@packages/hooks";
import {
  ChevronRightIcon,
  LogOutIcon,
  MoonIcon,
  SettingsIcon,
  SlidersIcon,
  SunIcon,
} from "@packages/icons";
import { DropdownMenu, Skeleton, Sidebar as UiSidebar } from "@packages/ui";
import { cn } from "@packages/utils";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { UserAvatar, useCurrentUser, usePreferences } from "@/entities/user";
import { useLogout } from "@/features/auth";
import { MediaSettingsDialog } from "@/features/media-settings";
import { paths } from "@/shared/config";

export function NavUser() {
  const { t } = useTranslation("common");
  const { data: user, isLoading } = useCurrentUser();
  const { logout, isPending } = useLogout();
  const [isMediaSettingsOpen, setIsMediaSettingsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const preferences = usePreferences();
  const isMobile = useIsMobile();

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
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenu.Trigger asChild>
            <UiSidebar.MenuButton
              size="lg"
              tooltip={displayName}
              className="overflow-visible data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-sidebar-accent/80 transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-0!"
            >
              <div className="relative flex shrink-0 items-center justify-center p-0.5">
                <UserAvatar
                  src={user?.avatarUrl}
                  name={user?.displayName}
                  email={user?.email}
                  size="md"
                />
                <span className="absolute bottom-0.5 right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-sidebar" />
              </div>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">{displayName}</span>
                {email ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {email}
                  </span>
                ) : null}
              </div>
              <ChevronRightIcon
                className={cn(
                  "ml-auto size-4 text-muted-foreground transition-transform duration-200 group-data-[collapsible=icon]:hidden",
                  isMenuOpen ? "-rotate-90" : "rotate-90",
                )}
              />
            </UiSidebar.MenuButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            className="w-56 [&_svg]:size-4"
            side={isMobile ? "top" : "right"}
            align="end"
            sideOffset={8}
            alignOffset={14}
          >
            <DropdownMenu.Item asChild>
              <Link href={paths.profile}>
                <SettingsIcon size="sm" />
                {t("navigation.settings")}
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => setIsMediaSettingsOpen(true)}>
              <SlidersIcon size="sm" />
              {t("navigation.mediaSettings")}
            </DropdownMenu.Item>
            {preferences && (
              <DropdownMenu.Item onSelect={() => preferences?.toggleTheme()}>
                {preferences.resolvedTheme === "dark" ? (
                  <SunIcon size="sm" />
                ) : (
                  <MoonIcon size="sm" />
                )}
                {t("navigation.theme")}
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              variant="destructive"
              disabled={isPending}
              onSelect={() => logout()}
            >
              <LogOutIcon size="sm" />
              {t("navigation.logout")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </UiSidebar.MenuItem>
      <MediaSettingsDialog
        open={isMediaSettingsOpen}
        onOpenChange={setIsMediaSettingsOpen}
      />
    </UiSidebar.Menu>
  );
}
