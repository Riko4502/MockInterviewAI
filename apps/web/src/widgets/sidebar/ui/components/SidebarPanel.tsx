"use client";

import { Sidebar as UiSidebar } from "@packages/ui";
import { useMemo } from "react";
import { useIsAdmin } from "@/entities/session";
import { ADMIN_NAV_ITEMS, NAV_GROUPS } from "../../model/constants";
import type { NavGroup, NavItem } from "../../model/types";
import { NavUser } from "./NavUser";
import { SidebarBrand } from "./SidebarBrand";
import { SidebarNav } from "./SidebarNav";

interface SidebarPanelProps {
  items?: NavItem[];
  groups?: NavGroup[];
}

export function SidebarPanel({ items, groups }: SidebarPanelProps) {
  const isAdmin = useIsAdmin();

  const baseGroups = useMemo(
    () => groups ?? (items ? [{ items }] : NAV_GROUPS),
    [groups, items],
  );

  const effectiveGroups = useMemo<NavGroup[]>(() => {
    if (isAdmin) {
      return [
        ...baseGroups,
        {
          labelKey: "navigation.administration",
          items: ADMIN_NAV_ITEMS,
        },
      ];
    }

    return baseGroups;
  }, [isAdmin, baseGroups]);

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
