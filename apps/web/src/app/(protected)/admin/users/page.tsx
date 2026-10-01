"use client";

import { useTranslation } from "react-i18next";
import { Sidebar } from "@/widgets/sidebar";

export default function AdminUsersPage() {
  const { t } = useTranslation("common");
  return (
    <Sidebar>
      <h1 className="text-2xl font-bold text-foreground">
        {t("navigation.adminUsers")}
      </h1>
    </Sidebar>
  );
}
