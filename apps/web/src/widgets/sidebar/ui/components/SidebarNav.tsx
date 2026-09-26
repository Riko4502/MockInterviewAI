"use client";

import { ChevronRightIcon } from "@packages/icons";
import { Collapsible, Sidebar as UiSidebar, useSidebar } from "@packages/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isNavItemActive } from "../../model/is-nav-item-active";
import type { NavGroup, NavItem } from "../../model/types";
import "@/shared/lib/i18n";

export interface SidebarNavProps {
  items?: NavItem[];
  groups?: NavGroup[];
}

export function SidebarNav({ items, groups }: SidebarNavProps) {
  const pathname = usePathname();
  const { t } = useTranslation("common");
  const sidebar = useSidebar({ optional: true });
  const isSidebarCollapsed = sidebar?.state === "collapsed";
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const effectiveGroups: NavGroup[] =
    groups && groups.length > 0 ? groups : items ? [{ items }] : [];

  return (
    <div className="flex flex-col gap-4">
      {effectiveGroups.map((group) => {
        const menuContent = (
          <UiSidebar.Menu className="gap-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const label = t(item.labelKey);
              const isActive = isNavItemActive(pathname, item.href);

              return (
                <UiSidebar.MenuItem key={item.href}>
                  <UiSidebar.MenuButton
                    asChild
                    isActive={isActive}
                    tooltip={label}
                    className={
                      isActive
                        ? "relative font-medium text-primary bg-primary/10 hover:bg-primary/15 hover:text-primary transition-all duration-150 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-primary group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:[&_svg]:size-5"
                        : "text-muted-foreground hover:text-foreground transition-all duration-150 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:[&_svg]:size-5"
                    }
                  >
                    <Link
                      href={item.href}
                      className="flex items-center gap-2 group/nav-link group-data-[collapsible=icon]:justify-center"
                    >
                      <Icon
                        className={
                          isActive
                            ? "text-primary shrink-0 transition-transform duration-150"
                            : "text-muted-foreground group-hover/nav-link:text-foreground group-hover/nav-link:scale-110 shrink-0 transition-all duration-150"
                        }
                      />
                      <span className="truncate group-data-[collapsible=icon]:hidden">
                        {label}
                      </span>
                      {item.badge != null && (
                        <UiSidebar.MenuBadge>{item.badge}</UiSidebar.MenuBadge>
                      )}
                    </Link>
                  </UiSidebar.MenuButton>
                </UiSidebar.MenuItem>
              );
            })}
          </UiSidebar.Menu>
        );

        const groupKey =
          group.labelKey ?? group.items[0]?.href ?? "default-group";

        if (!group.labelKey) {
          return (
            <UiSidebar.Group key={groupKey} className="p-0">
              <UiSidebar.GroupContent>{menuContent}</UiSidebar.GroupContent>
            </UiSidebar.Group>
          );
        }

        const isGroupOpen = isSidebarCollapsed
          ? true
          : (openGroups[groupKey] ?? true);

        return (
          <Collapsible
            key={groupKey}
            open={isGroupOpen}
            onOpenChange={(isOpen) => {
              setOpenGroups((prev) => ({ ...prev, [groupKey]: isOpen }));
            }}
            className="group/collapsible"
          >
            <UiSidebar.Group className="p-0">
              <UiSidebar.GroupLabel
                asChild
                className="px-3 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase select-none"
              >
                <Collapsible.Trigger className="flex w-full items-center justify-between cursor-pointer hover:text-foreground transition-colors group-data-[collapsible=icon]:pointer-events-none">
                  <span>{t(group.labelKey)}</span>
                  <ChevronRightIcon className="size-3 text-muted-foreground/60 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
                </Collapsible.Trigger>
              </UiSidebar.GroupLabel>
              <Collapsible.Content
                forceMount={isSidebarCollapsed || undefined}
                className="overflow-hidden transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down group-data-[collapsible=icon]:!block"
              >
                <UiSidebar.GroupContent>{menuContent}</UiSidebar.GroupContent>
              </Collapsible.Content>
            </UiSidebar.Group>
          </Collapsible>
        );
      })}
    </div>
  );
}
