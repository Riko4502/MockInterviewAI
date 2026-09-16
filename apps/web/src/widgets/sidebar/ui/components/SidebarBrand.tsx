"use client";

import { Logo, Sidebar as UiSidebar, useSidebar } from "@packages/ui";
import { paths } from "@/shared/config";

export function SidebarBrand() {
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
