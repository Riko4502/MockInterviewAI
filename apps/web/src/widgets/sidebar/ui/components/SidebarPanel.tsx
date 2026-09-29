"use client";

import { Sidebar as UiSidebar } from "@packages/ui";
import { useTranslation } from "react-i18next";
import { useIsAdmin } from "@/entities/session";
import { ADMIN_NAV_ITEMS } from "../../model/constants";
import type { NavItem } from "../../model/types";
import { NavUser } from "./NavUser";
import { SidebarBrand } from "./SidebarBrand";
import { SidebarNav } from "./SidebarNav";

export function SidebarPanel({ items }: { items: NavItem[] }) {
  const isAdmin = useIsAdmin();
  const { t } = useTranslation("common");
  return (
    <UiSidebar collapsible="icon">
      <UiSidebar.Header>
        <SidebarBrand />
      </UiSidebar.Header>
      <UiSidebar.Content className="p-2">
        <SidebarNav items={items} />
        {isAdmin && (
          <UiSidebar.Group>
            <UiSidebar.GroupLabel>
              {t("navigation.administration")}
            </UiSidebar.GroupLabel>
            <UiSidebar.GroupContent>
              <SidebarNav items={ADMIN_NAV_ITEMS} />
            </UiSidebar.GroupContent>
          </UiSidebar.Group>
        )}
      </UiSidebar.Content>
      <UiSidebar.Footer>
        <NavUser />
      </UiSidebar.Footer>
      <UiSidebar.Rail />
    </UiSidebar>
  );
}
