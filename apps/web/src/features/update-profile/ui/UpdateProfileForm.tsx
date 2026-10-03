"use client";

import { HubConnectionIcon, SettingsIcon, UserIcon } from "@packages/icons";
import { Skeleton, Tabs } from "@packages/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/entities/user";
import "@/shared/lib/i18n";
import { AccountsTab } from "./AccountsTab";
import { GeneralTab } from "./GeneralTab";
import { SecurityTab } from "./SecurityTab";

type ProfileTab = "general" | "accounts" | "security";

function resolveInitialTab(): ProfileTab {
  if (typeof window === "undefined") return "general";

  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab") as ProfileTab | null;
  if (tab && (tab === "general" || tab === "accounts" || tab === "security")) {
    return tab;
  }

  if (params.has("github") || params.has("error")) {
    return "accounts";
  }

  return "general";
}

export function UpdateProfileForm() {
  const { t } = useTranslation("common");
  const { data: user, isLoading, isError } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<ProfileTab>("general");

  useEffect(() => {
    setActiveTab(resolveInitialTab());
  }, []);

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Skeleton className="h-8 w-40" />
        <div className="flex flex-col gap-6 sm:flex-row">
          <Skeleton className="h-40 w-full sm:w-64 shrink-0" />
          <Skeleton className="h-96 flex-1" />
        </div>
      </div>
    );
  }

  if (isError || !user) {
    return <p className="text-sm text-destructive">{t("profile.loadError")}</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground">
          {t("profile.title")}
        </h1>
        <p className="text-muted-foreground">{t("profile.subtitle")}</p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as ProfileTab)}
        orientation="vertical"
        variant="pills"
        className="w-full flex-col sm:flex-row gap-8 items-start"
      >
        <Tabs.List className="w-full sm:w-64 shrink-0 flex flex-col gap-1.5 bg-transparent p-0 border-0 h-auto items-stretch">
          <Tabs.Trigger
            value="general"
            className="w-full justify-start gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium"
          >
            <UserIcon size="sm" className="size-4 shrink-0" />
            <span>{t("profile.tabs.general")}</span>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="accounts"
            className="w-full justify-start gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium"
          >
            <HubConnectionIcon size="sm" className="size-4 shrink-0" />
            <span>{t("profile.tabs.accounts")}</span>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="security"
            className="w-full justify-start gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium"
          >
            <SettingsIcon size="sm" className="size-4 shrink-0" />
            <span>{t("profile.tabs.security")}</span>
          </Tabs.Trigger>
        </Tabs.List>

        <div className="flex-1 w-full min-w-0">
          <Tabs.Content value="general" className="mt-0">
            <GeneralTab user={user} />
          </Tabs.Content>

          <Tabs.Content value="accounts" className="mt-0">
            <AccountsTab user={user} />
          </Tabs.Content>

          <Tabs.Content value="security" className="mt-0 flex flex-col gap-6">
            <SecurityTab />
          </Tabs.Content>
        </div>
      </Tabs>
    </div>
  );
}
