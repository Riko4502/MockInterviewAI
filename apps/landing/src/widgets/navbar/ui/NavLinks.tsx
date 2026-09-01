"use client";

import { cn } from "@packages/utils";
import { useLandingTranslations } from "@/shared/lib";

interface NavLinksProps {
  className?: string;
}

export function NavLinks({ className }: NavLinksProps) {
  const { landing } = useLandingTranslations();

  return (
    <nav
      className={cn(
        "hidden md:flex items-center gap-8 text-sm font-medium text-slate-300",
        className,
      )}
    >
      <a
        href="#how-it-works"
        className="hover:text-white transition-colors py-1 relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-violet-400 hover:after:w-full after:transition-all"
      >
        {landing.nav.howItWorks}
      </a>
      <a
        href="#features"
        className="hover:text-white transition-colors py-1 relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-violet-400 hover:after:w-full after:transition-all"
      >
        {landing.nav.features}
      </a>
    </nav>
  );
}
