"use client";

import { MenuIcon } from "@packages/icons";
import { Button } from "@packages/ui";
import { useState } from "react";
import { NavLanguageSwitcher } from "@/features/language-switcher";
import { getAuthUrl, getRegisterUrl } from "@/shared/config";
import { useLandingTranslations } from "@/shared/lib";
import { Logo } from "@/shared/ui";
import { NavLinks } from "./NavLinks";
import { NavMobileMenu } from "./NavMobileMenu";
import { ScrollProgressBar } from "./ScrollProgressBar";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { landing, locale } = useLandingTranslations();
  const homeUrl = locale === "ru" ? "/" : "/en";
  const authUrl = getAuthUrl();
  const registerUrl = getRegisterUrl();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[#07080e]/35 backdrop-blur-2xl transition-all shadow-[0_4px_30px_rgba(0,0,0,0.15)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Logo href={homeUrl} />

        {/* Desktop Nav Links */}
        <NavLinks />

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <NavLanguageSwitcher />

          <Button
            asChild
            variant="ghost"
            className="hidden sm:inline-flex text-sm font-medium text-slate-300 hover:text-white hover:bg-white/[0.06]"
          >
            <a href={authUrl}>{landing.nav.signIn}</a>
          </Button>

          <Button
            asChild
            className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-600/30 hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all px-5 py-2.5 h-auto text-sm font-semibold"
          >
            <a href={registerUrl}>{landing.nav.getStarted}</a>
          </Button>

          {/* Mobile Menu Toggle Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden rounded-xl text-slate-400 hover:text-white hover:bg-white/5 border-white/10"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <MenuIcon className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      <NavMobileMenu isOpen={mobileMenuOpen} />

      {/* Neon Scroll Progress Indicator */}
      <ScrollProgressBar />
    </header>
  );
}
