"use client";

import {
  BookIcon,
  CodeIcon,
  HelpIcon,
  TrendUpIcon,
  UsersIcon,
} from "@packages/icons";
import { Logo } from "@packages/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation("common");

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 px-6">
        <Logo href={paths.dashboard} variant="full" size="md" />
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <Icon className="size-5 shrink-0" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
