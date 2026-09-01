"use client";

import { GlobeIcon } from "@packages/icons";
import { Button, Link } from "@packages/ui";
import { useLandingTranslations } from "@/shared/lib";

export function NavLanguageSwitcher() {
  const { locale } = useLandingTranslations();
  const switchLangUrl = locale === "ru" ? "/en" : "/";
  const switchLangLabel = locale === "ru" ? "EN" : "RU";

  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="rounded-full bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white px-3 py-1.5 h-auto shadow-sm gap-1.5 text-xs font-semibold font-mono"
    >
      <Link href={switchLangUrl} title="Switch language / Сменить язык">
        <GlobeIcon className="w-3.5 h-3.5 text-violet-400" />
        <span>{switchLangLabel}</span>
      </Link>
    </Button>
  );
}
