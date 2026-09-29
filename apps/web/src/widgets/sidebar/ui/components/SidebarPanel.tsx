"use client";

import { Sidebar as UiSidebar } from "@packages/ui";
import { useIsAdmin } from "@/entities/session";
import { ADMIN_NAV_ITEMS, NAV_GROUPS } from "../../model/constants";
import type { NavGroup, NavItem } from "../../model/types";
import { NavUser } from "./NavUser";
import { SidebarBrand } from "./SidebarBrand";
import { SidebarNav } from "./SidebarNav";

export function SidebarPanel({
  items,
  groups = NAV_GROUPS,
}: {
  items?: NavItem[];
  groups?: NavGroup[];
}) {
  const isAdmin = useIsAdmin();

  const baseGroups = groups ?? (items ? [{ items }] : NAV_GROUPS);
  const effectiveGroups: NavGroup[] = isAdmin
    ? [
        ...baseGroups,
        {
          labelKey: "navigation.administration",
          items: ADMIN_NAV_ITEMS,
        },
      ]
    : baseGroups;

  return (
    <UiSidebar collapsible="icon">
      <UiSidebar.Header>
        <SidebarBrand />
      </UiSidebar.Header>
      <UiSidebar.Content className="p-2">
        <SidebarNav items={items} groups={effectiveGroups} />
      </UiSidebar.Content>
      <UiSidebar.Footer>
        <NavUser />
      </UiSidebar.Footer>
      <UiSidebar.Rail />
    </UiSidebar>
  );
}
