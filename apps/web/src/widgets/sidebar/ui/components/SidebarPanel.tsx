"use client";

import { Sidebar as UiSidebar } from "@packages/ui";
import type { NavItem } from "../../model/types";
import { NavUser } from "./NavUser";
import { SidebarBrand } from "./SidebarBrand";
import { SidebarNav } from "./SidebarNav";

export function SidebarPanel({ items }: { items: NavItem[] }) {
  return (
    <UiSidebar collapsible="icon">
      <UiSidebar.Header>
        <SidebarBrand />
      </UiSidebar.Header>
      <UiSidebar.Content className="p-2">
        <SidebarNav items={items} />
      </UiSidebar.Content>
      <UiSidebar.Footer>
        <NavUser />
      </UiSidebar.Footer>
      <UiSidebar.Rail />
    </UiSidebar>
  );
}
