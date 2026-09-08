"use client";

import { type Locale, langConfig, localeLabels } from "@packages/i18n";
import { GlobeIcon } from "@packages/icons";
import { Button, Tooltip } from "@packages/ui";
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
  const locale: Locale =
    propLocale ??
    ((i18n.resolvedLanguage || i18n.language) === "en" ? "en" : "ru");

  const targetLocale: Locale = locale === "ru" ? "en" : "ru";
  const switchUrl = langConfig[locale].switchUrl;
  const switchLabel = localeLabels[targetLocale];

  useEffect(() => {
    const browserLocale = normalizeBrowserLocale();
    if (browserLocale && browserLocale !== locale) {
      setBrowserHint(
        browserLocale === "en"
          ? "Your browser language is English"
          : "Язык вашего браузера — русский",
      );
    }
  }, [locale]);

  const title = browserHint
    ? `${browserHint} — Switch to ${switchLabel}`
    : "Switch language / Сменить язык";

  return (
    <Tooltip content={title} withArrow>
      <Button
        asChild
        variant="outline"
        size="sm"
        className="rounded-full bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white px-3 py-1.5 h-auto shadow-sm gap-1.5 text-xs font-semibold font-mono"
      >
        <Link href={switchUrl}>
          <GlobeIcon className="w-3.5 h-3.5 text-violet-400" />
          <span>{switchLabel}</span>
        </Link>
      </Button>
    </Tooltip>
  );
}

export default NavLanguageSwitcher;
