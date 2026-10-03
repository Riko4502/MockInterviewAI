import { NotificationBell } from "@widgets/notifications";
import { Sidebar } from "@widgets/sidebar";
import type { ReactNode } from "react";

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <Sidebar headerActions={<NotificationBell />}>{children}</Sidebar>;
}
