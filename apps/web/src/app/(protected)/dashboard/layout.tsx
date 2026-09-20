import { NotificationBell } from "@widgets/header";
import { Sidebar } from "@widgets/sidebar";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <Sidebar headerActions={<NotificationBell />}>{children}</Sidebar>;
}
