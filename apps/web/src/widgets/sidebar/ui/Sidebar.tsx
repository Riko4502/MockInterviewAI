"use client";

import {
  BellIcon,
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

type NavIcon = typeof HelpIcon;

type NavItem = {
  labelKey:
    | "navigation.dashboard"
    | "navigation.notifications"
    | "navigation.interviews"
    | "navigation.findPartners"
    | "navigation.statistics"
    | "navigation.resources";
  href: string;
  icon: NavIcon;
};

const NAV_ITEMS: NavItem[] = [
  { labelKey: "navigation.dashboard", href: paths.dashboard, icon: HelpIcon },
  {
    labelKey: "navigation.notifications",
    href: paths.notifications,
    icon: BellIcon,
  },
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
];

function isNavItemActive(pathname: string, href: string) {
  return (
    pathname === href || (href !== paths.dashboard && pathname.startsWith(href))
  );
}

function SidebarBrand() {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <UiSidebar.Menu>
      <UiSidebar.MenuItem>
        <UiSidebar.MenuButton size="lg" asChild tooltip="DEVSYNC Interview AI">
          <Logo
            href={paths.dashboard}
            variant={collapsed ? "icon" : "full"}
            size="sm"
            className="overflow-hidden [&>div]:shadow-none [&>div]:group-hover:scale-100"
          />
        </UiSidebar.MenuButton>
      </UiSidebar.MenuItem>
    </UiSidebar.Menu>
  );
}

function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const { t } = useTranslation("common");

  return (
    <UiSidebar.Menu>
      {items.map((item) => {
        const Icon = item.icon;
        const label = t(item.labelKey);
        const isActive = isNavItemActive(pathname, item.href);

        return (
          <UiSidebar.MenuItem key={item.href}>
            <UiSidebar.MenuButton asChild isActive={isActive} tooltip={label}>
              <Link href={item.href}>
                <Icon />
                <span>{label}</span>
              </Link>
            </UiSidebar.MenuButton>
          </UiSidebar.MenuItem>
        );
      })}
    </UiSidebar.Menu>
  );
}

function SidebarPanel({ items }: { items: NavItem[] }) {
  return (
    <UiSidebar collapsible="icon">
      <UiSidebar.Header>
        <SidebarBrand />
      </UiSidebar.Header>
      <UiSidebar.Content className="p-2">
        <SidebarNav items={items} />
      </UiSidebar.Content>
      <UiSidebar.Rail />
    </UiSidebar>
  );
}

export function Sidebar({ children }: { children: ReactNode }) {
  return (
    <UiSidebar.Provider>
      <SidebarPanel items={NAV_ITEMS} />
      <UiSidebar.Inset>
        <header className="flex gap-2 items-center px-4 h-12 border-b shrink-0">
          <UiSidebar.Trigger />
        </header>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </UiSidebar.Inset>
    </UiSidebar.Provider>
  );
}
