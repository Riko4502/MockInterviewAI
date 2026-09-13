"use client";

import { Badge, Logo, Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";

export function FooterBrand() {
  const { t, i18n } = useTranslation("landing");
  const locale =
    (i18n.resolvedLanguage || i18n.language) === "ru" ? "ru" : "en";
  const homeUrl = locale === "ru" ? "/" : "/en";

  return (
    <div className="md:col-span-4 flex flex-col items-start">
      <Logo href={homeUrl} className="mb-4" />

      <Typography.Muted className="text-xs text-slate-400 leading-relaxed mb-6 max-w-sm">
        {t("footer.desc")}
      </Typography.Muted>

      {/* System status pill */}
      <Badge
        variant="statusSuccess"
        className="gap-2 px-3 py-1 bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-xs font-mono"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>{t("footer.status")}</span>
      </Badge>
    </div>
  );
}
