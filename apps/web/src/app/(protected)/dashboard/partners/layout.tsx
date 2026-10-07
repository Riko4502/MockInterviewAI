"use client";

import { useMatchmakingControllerGetUnreadCount } from "@packages/api";
import { PlusIcon } from "@packages/icons";
import { Button } from "@packages/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";

export default function PartnersLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation("showcase");
  const pathname = usePathname();

  const { data: unreadData } = useMatchmakingControllerGetUnreadCount();
  const unreadCount =
    (unreadData as unknown as { pendingCount?: number })?.pendingCount ?? 0;

  const isNewPage = pathname === paths.partnersNew;

  if (isNewPage) {
    return <div className="w-full">{children}</div>;
  }

  const isCatalog = pathname === paths.partners;
  const isMyCards = pathname === paths.partnersMy;
  const isRequests = pathname === paths.partnersRequests;

  return (
    <div className="flex flex-col gap-6">
      {/* Шапка раздела */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>

        <Button
          asChild
          variant="default"
          size="default"
          className="gap-2 font-semibold shadow-xs self-start sm:self-auto"
        >
          <Link href={paths.partnersNew}>
            <PlusIcon className="size-4" />
            <span>{t("createCard")}</span>
          </Link>
        </Button>
      </div>

      {/* Табы навигации */}
      <div className="flex border-b border-border">
        <Link
          href={paths.partners}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150 ${
            isCatalog
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("tabs.catalog")}
        </Link>
        <Link
          href={paths.partnersMy}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150 ${
            isMyCards
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("tabs.myCards")}
        </Link>
        <Link
          href={paths.partnersRequests}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150 flex items-center gap-2 ${
            isRequests
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>{t("tabs.requests")}</span>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-primary rounded-full">
              {unreadCount}
            </span>
          )}
        </Link>
      </div>

      {/* Контент активного таба */}
      <div>{children}</div>
    </div>
  );
}
