"use client";

import { Logo, Sidebar as UiSidebar, useSidebar } from "@packages/ui";
import Link from "next/link";
import { paths } from "@/shared/config";

export function SidebarBrand() {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <UiSidebar.Menu>
      <UiSidebar.MenuItem>
        <UiSidebar.MenuButton
          size="lg"
          asChild
          tooltip="DEVSYNC Interview AI"
          className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
        >
          <Logo
            asChild
            variant={collapsed ? "icon" : "full"}
            size="sm"
            className="overflow-hidden [&>div]:shadow-none [&>div]:group-hover:scale-100"
          >
            <Link href={paths.dashboard} />
          </Logo>
        </UiSidebar.MenuButton>
      </UiSidebar.MenuItem>
    </UiSidebar.Menu>
  );
}
