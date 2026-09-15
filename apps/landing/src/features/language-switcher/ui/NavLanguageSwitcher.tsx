"use client";

import { type Locale, langConfig, localeLabels, locales } from "@packages/i18n";
import { GlobeIcon } from "@packages/icons";
import { Tooltip } from "@packages/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { normalizeBrowserLocale } from "@/shared/lib";

export interface NavLanguageSwitcherProps {
  locale?: Locale;
}

export function NavLanguageSwitcher({
  locale: propLocale,
}: NavLanguageSwitcherProps = {}) {
  const { i18n } = useTranslation();
  const [browserHint, setBrowserHint] = useState<string | null>(null);

  // Authoritative locale from prop (URL route) or synchronized i18n state
  const currentLocale: Locale =
    propLocale ??
    ((i18n.resolvedLanguage || i18n.language) === "en" ? "en" : "ru");

  useEffect(() => {
    const browserLocale = normalizeBrowserLocale();
    if (browserLocale && browserLocale !== currentLocale) {
      setBrowserHint(
        browserLocale === "en"
          ? "Your browser language is English"
          : "Язык вашего браузера — русский",
      );
    }
  }, [currentLocale]);

  const tooltipText = browserHint
    ? `${browserHint} • ${localeLabels[currentLocale]}`
    : "Выбор языка / Language selection";

  return (
    <Tooltip content={tooltipText} withArrow>
      <nav
        aria-label="Language selector"
        className="inline-flex items-center gap-1 p-1 rounded-full bg-slate-200/60 dark:bg-white/[0.06] border border-slate-300/60 dark:border-white/10 shadow-inner backdrop-blur-md select-none"
      >
        <div className="pl-1.5 pr-0.5 text-muted-foreground/80 hidden sm:flex items-center justify-center">
          <GlobeIcon className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
        </div>

        <div className="flex items-center gap-0.5">
          {locales.map((loc) => {
            const isActive = loc === currentLocale;
            const targetUrl = langConfig[loc].homeUrl;
            const label = loc.toUpperCase();

            if (isActive) {
              return (
                <span
                  key={loc}
                  aria-current="true"
                  className="px-2.5 py-1 text-xs font-semibold font-mono rounded-full bg-white dark:bg-violet-600 text-foreground dark:text-white shadow-sm transition-all duration-200 cursor-default"
                >
                  {label}
                </span>
              );
            }

            return (
              <Link
                key={loc}
                href={targetUrl}
                aria-label={`Switch to ${localeLabels[loc]}`}
                className="px-2.5 py-1 text-xs font-medium font-mono rounded-full text-muted-foreground hover:text-foreground hover:bg-slate-300/50 dark:hover:bg-white/10 transition-all duration-200"
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </Tooltip>
  );
}

export default NavLanguageSwitcher;
