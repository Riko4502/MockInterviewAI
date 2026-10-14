"use client";

import { SystemRole } from "@packages/types";
import { useToast } from "@packages/ui";
import { type ReactNode, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { RoleBoundary } from "@/features/auth";
import { paths } from "@/shared/config";
import { NotificationBell } from "@/widgets/notifications";
import { Sidebar } from "@/widgets/sidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { push } = useToast();
  const { t } = useTranslation("common");

  const onDenied = useCallback(() => {
    push({
      id: "admin-access-denied",
      status: "warning",
      title: t("errors.forbiddenTitle"),
      description: t("errors.forbiddenDescription"),
    });
  }, [push, t]);

  return (
    <RoleBoundary
      allowedRoles={[SystemRole.ADMIN]}
      redirectTo={paths.dashboard}
      onDenied={onDenied}
    >
      <Sidebar headerActions={<NotificationBell />}>{children}</Sidebar>
    </RoleBoundary>
  );
}
