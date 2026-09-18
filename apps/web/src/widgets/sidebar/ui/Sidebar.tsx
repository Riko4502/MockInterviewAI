"use client";

import { Sidebar as UiSidebar } from "@packages/ui";
import type { ReactNode } from "react";
import { NAV_ITEMS } from "../model/constants";
import { SidebarPanel } from "./components";

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
