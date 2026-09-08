"use client";

import { langConfig } from "@packages/i18n";
import { GlobeIcon } from "@packages/icons";
import { Button, Link } from "@packages/ui";
import { useTranslation } from "react-i18next";

export function NavLanguageSwitcher() {
  const { i18n } = useTranslation();
  const locale =
    (i18n.resolvedLanguage || i18n.language) === "ru" ? "ru" : "en";

  const { switchUrl, switchLabel } = langConfig[locale];

  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="rounded-full bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white px-3 py-1.5 h-auto shadow-sm gap-1.5 text-xs font-semibold font-mono"
    >
      <Link href={switchUrl} title="Switch language / Сменить язык">
        <GlobeIcon className="w-3.5 h-3.5 text-violet-400" />
        <span>{switchLabel}</span>
      </Link>
    </Button>
  );
}
