"use client";

import {
  BookIcon,
  CodeIcon,
  HelpIcon,
  TrendUpIcon,
  UsersIcon,
} from "@packages/icons";
import { Logo, Sidebar as UiSidebar, useSidebar } from "@packages/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";

const NAV_ITEMS = [
  { labelKey: "navigation.dashboard", href: paths.dashboard, icon: HelpIcon },
  {
    labelKey: "navigation.interviews",
    href: paths.interviews,
    icon: CodeIcon,
  },
  {
    labelKey: "navigation.findPartners",
    href: paths.partners,
    icon: UsersIcon,
  },
  {
    labelKey: "navigation.statistics",
    href: paths.statistics,
    icon: TrendUpIcon,
  },
  {
    labelKey: "navigation.resources",
    href: paths.resources,
    icon: BookIcon,
  },
] as const;

function isNavItemActive(pathname: string, href: string) {
  return (
    pathname === href || (href !== paths.dashboard && pathname.startsWith(href))
  );
}

function SidebarBrand() {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <Logo
      href={paths.dashboard}
      variant={collapsed ? "icon" : "full"}
      size={collapsed ? "sm" : "md"}
      className={collapsed ? "mx-auto" : undefined}
    />
  );
}

function SidebarPanel() {
  const pathname = usePathname();
  const { t } = useTranslation("common");

  return (
    <UiSidebar collapsible="icon">
      <UiSidebar.Header>
        <SidebarBrand />
      </UiSidebar.Header>

      <UiSidebar.Content>
        <UiSidebar.Group>
          <UiSidebar.GroupContent>
            <UiSidebar.Menu>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const label = t(item.labelKey);
                const isActive = isNavItemActive(pathname, item.href);

                return (
                  <UiSidebar.MenuItem key={item.href}>
                    <UiSidebar.MenuButton
                      asChild
                      isActive={isActive}
                      tooltip={label}
                    >
                      <Link href={item.href}>
                        <Icon />
                        <span>{label}</span>
                      </Link>
                    </UiSidebar.MenuButton>
                  </UiSidebar.MenuItem>
                );
              })}
            </UiSidebar.Menu>
          </UiSidebar.GroupContent>
        </UiSidebar.Group>
      </UiSidebar.Content>
      <UiSidebar.Rail />
    </UiSidebar>
  );
}

export function Sidebar({ children }: { children: ReactNode }) {
  return (
    <UiSidebar.Provider>
      <SidebarPanel />
      <UiSidebar.Inset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <UiSidebar.Trigger />
        </header>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </UiSidebar.Inset>
    </UiSidebar.Provider>
  );
}
