"use client";

import { Sidebar as UiSidebar } from "@packages/ui";
import { NAV_GROUPS } from "../../model/constants";
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
  return (
    <UiSidebar collapsible="icon">
      <UiSidebar.Header>
        <SidebarBrand />
      </UiSidebar.Header>
      <UiSidebar.Content className="p-2">
        <SidebarNav items={items} groups={groups} />
      </UiSidebar.Content>
      <UiSidebar.Footer>
        <NavUser />
      </UiSidebar.Footer>
      <UiSidebar.Rail />
    </UiSidebar>
  );
}
