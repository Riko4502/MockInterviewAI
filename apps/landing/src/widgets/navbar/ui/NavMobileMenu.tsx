"use client";

import { getAuthUrl } from "@/shared/config";
import { useLandingTranslations } from "@/shared/lib";

interface NavMobileMenuProps {
  isOpen: boolean;
}

export function NavMobileMenu({ isOpen }: NavMobileMenuProps) {
  const { landing } = useLandingTranslations();
  const authUrl = getAuthUrl();

  if (!isOpen) return null;

  return (
    <div className="md:hidden border-t border-white/10 bg-[#090a10]/95 backdrop-blur-2xl px-4 pt-4 pb-6 space-y-4">
      <div className="flex flex-col space-y-3">
        <a
          href="#how-it-works"
          className="text-base font-medium text-slate-200 hover:text-violet-400 py-2 border-b border-white/5"
        >
          {landing.nav.howItWorks}
        </a>
        <a
          href="#features"
          className="text-base font-medium text-slate-200 hover:text-violet-400 py-2 border-b border-white/5"
        >
          {landing.nav.features}
        </a>
        <a
          href={authUrl}
          className="text-base font-medium text-slate-200 hover:text-violet-400 py-2"
        >
          {landing.nav.signIn}
        </a>
      </div>
    </div>
  );
}
