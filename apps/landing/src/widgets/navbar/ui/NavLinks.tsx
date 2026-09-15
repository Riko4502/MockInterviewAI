"use client";

import { cn } from "@packages/utils";
import NextLink from "next/link";
import { useTranslation } from "react-i18next";
import { NAV_LINKS } from "../constants";

interface NavLinksProps {
  className?: string;
}

export function NavLinks({ className }: NavLinksProps) {
  const { t } = useTranslation("landing");

  return (
    <nav
      className={cn(
        "hidden md:flex items-center gap-1 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {NAV_LINKS.map((link) => (
        <NextLink
          key={link.href}
          href={link.href}
          className="px-3 py-1.5 rounded-full hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all text-muted-foreground"
        >
          {t(link.labelKey)}
        </NextLink>
      ))}
    </nav>
  );
}
