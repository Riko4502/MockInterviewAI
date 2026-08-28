"use client";

import { Badge } from "@packages/ui";
import { useLandingTranslations } from "@/shared/lib";
import { Logo } from "@/shared/ui";

export function FooterBrand() {
  const { landing, locale } = useLandingTranslations();
  const homeUrl = locale === "ru" ? "/" : "/en";

  return (
    <div className="md:col-span-4 flex flex-col items-start">
      <Logo href={homeUrl} className="mb-4" />

      <p className="text-xs text-slate-400 leading-relaxed mb-6 max-w-sm">
        {landing.footer.desc}
      </p>

      {/* System status pill */}
      <Badge
        variant="statusSuccess"
        className="gap-2 px-3 py-1 bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-xs font-mono"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>{landing.footer.status}</span>
      </Badge>
    </div>
  );
}
