"use client";

import { Sidebar as UiSidebar } from "@packages/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { isNavItemActive } from "../../model/is-nav-item-active";
import type { NavItem } from "../../model/types";
import "@/shared/lib/i18n";

export function SidebarNav({ items }: { items: NavItem[] }) {
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
