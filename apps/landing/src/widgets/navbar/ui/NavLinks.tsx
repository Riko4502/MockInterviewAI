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
        "hidden md:flex items-center gap-8 text-sm font-medium text-slate-300",
        className,
      )}
    >
      {NAV_LINKS.map((link) => (
        <NextLink
          key={link.href}
          href={link.href}
          className="hover:text-white transition-colors py-1 relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-violet-400 hover:after:w-full after:transition-all text-slate-300"
        >
          {t(link.labelKey)}
        </NextLink>
      ))}
    </nav>
  );
}
