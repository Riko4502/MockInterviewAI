"use client";

import NextLink from "next/link";
import { useTranslation } from "react-i18next";
import { getAuthUrl } from "@/shared/config";
import { NAV_LINKS } from "../constants";

interface NavMobileMenuProps {
  isOpen: boolean;
}

export function NavMobileMenu({ isOpen }: NavMobileMenuProps) {
  const { t } = useTranslation("landing");
  const authUrl = getAuthUrl();

  if (!isOpen) return null;

  return (
    <div className="md:hidden border-t border-slate-200/70 dark:border-white/[0.06] bg-white/85 dark:bg-[#07080e]/90 backdrop-blur-2xl px-4 pt-4 pb-6 space-y-4 shadow-2xl">
      <div className="flex flex-col space-y-3">
        {NAV_LINKS.map((link) => (
          <NextLink
            key={link.href}
            href={link.href}
            className="text-base font-medium text-foreground hover:text-violet-500 py-2 border-b border-border/50 dark:border-white/5"
          >
            {t(link.labelKey)}
          </NextLink>
        ))}
        <a
          href={authUrl}
          className="text-base font-medium text-foreground hover:text-violet-500 py-2"
        >
          {t("nav.signIn")}
        </a>
      </div>
    </div>
  );
}
