"use client";

import { CheckIcon } from "@packages/icons";
import { useLandingTranslations } from "@/shared/lib";

export function CtaBenefits() {
  const { landing } = useLandingTranslations();

  return (
    <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs sm:text-sm text-slate-400 font-medium border-t border-white/10 pt-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <CheckIcon className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>{landing.cta.benefit1}</span>
      </div>
      <div className="flex items-center gap-2">
        <CheckIcon className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>{landing.cta.benefit2}</span>
      </div>
      <div className="flex items-center gap-2">
        <CheckIcon className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>{landing.cta.benefit3}</span>
      </div>
    </div>
  );
}
