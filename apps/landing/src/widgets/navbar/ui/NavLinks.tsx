"use client";

import { Link } from "@packages/ui";
import { cn } from "@packages/utils";
import { useTranslation } from "react-i18next";

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
      <Link
        href="#how-it-works"
        underline="none"
        className="hover:text-white transition-colors py-1 relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-violet-400 hover:after:w-full after:transition-all text-slate-300"
      >
        {t("nav.howItWorks")}
      </Link>
      <Link
        href="#features"
        underline="none"
        className="hover:text-white transition-colors py-1 relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-violet-400 hover:after:w-full after:transition-all text-slate-300"
      >
        {t("nav.features")}
      </Link>
    </nav>
  );
}
