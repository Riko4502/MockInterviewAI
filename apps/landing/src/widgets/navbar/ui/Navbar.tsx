"use client";

import { type Locale, langConfig } from "@packages/i18n";
import { MenuIcon } from "@packages/icons";
import { Button, Logo, ThemeToggle } from "@packages/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLanguageSwitcher } from "@/features/language-switcher";
import { getAuthUrl, getRegisterUrl } from "@/shared/config";
import { NavLinks } from "./NavLinks";
import { NavMobileMenu } from "./NavMobileMenu";
import { ScrollProgressBar } from "./ScrollProgressBar";

export interface NavbarProps {
  locale?: Locale;
}

export function Navbar({ locale: propLocale }: NavbarProps = {}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t, i18n } = useTranslation("landing");
  const locale =
    propLocale ??
    ((i18n.resolvedLanguage || i18n.language) === "ru" ? "ru" : "en");

  const { homeUrl } = langConfig[locale];

  const authUrl = getAuthUrl();
  const registerUrl = getRegisterUrl();

  return (
    <header className="sticky top-3 sm:top-4 z-50 w-full px-3 sm:px-6 pointer-events-none">
      <div className="relative max-w-5xl mx-auto rounded-full h-14 px-3 sm:px-5 flex items-center justify-between backdrop-blur-2xl bg-white/80 dark:bg-[#07080d]/80 border border-black/[0.07] dark:border-white/[0.09] shadow-[0_10px_35px_rgba(0,0,0,0.06)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.6)] pointer-events-auto transition-all overflow-hidden">
        {/* Brand Logo */}
        <Logo href={homeUrl} size="sm" className="sm:hidden shrink-0" />
        <Logo href={homeUrl} size="md" className="hidden sm:flex shrink-0" />

        {/* Desktop Nav Links */}
        <NavLinks />

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <NavLanguageSwitcher locale={locale} />
          <ThemeToggle
            tooltipLight={t("nav.themeLight")}
            tooltipDark={t("nav.themeDark")}
            ariaLabel={t("nav.toggleTheme")}
          />

          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-full px-3 h-8"
          >
            <a href={authUrl}>{t("nav.signIn")}</a>
          </Button>

          <Button
            asChild
            size="sm"
            className="hidden sm:inline-flex rounded-full bg-foreground text-background hover:opacity-90 active:scale-95 transition-all px-4 h-8 text-xs font-semibold shadow-md shadow-foreground/10"
          >
            <a href={registerUrl}>{t("nav.getStarted")}</a>
          </Button>

          {/* Mobile Menu Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden rounded-full w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <MenuIcon className="w-4 h-4" />
          </Button>
        </div>

        {/* Scroll Progress Indicator attached to Capsule */}
        <ScrollProgressBar />
      </div>

      {/* Mobile Dropdown Menu */}
      <NavMobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
    </header>
  );
}
