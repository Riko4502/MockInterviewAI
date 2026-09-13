"use client";

import { CheckIcon } from "@packages/icons";
import { useTranslation } from "react-i18next";
import { CTA_BENEFITS } from "../constants";

export function CtaBenefits() {
  const { t } = useTranslation("landing");

  return (
    <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs sm:text-sm text-slate-400 font-medium border-t border-white/10 pt-8 max-w-2xl mx-auto">
      {CTA_BENEFITS.map((benefitKey) => (
        <div key={benefitKey} className="flex items-center gap-2">
          <CheckIcon className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{t(benefitKey)}</span>
        </div>
      ))}
    </div>
  );
}
