"use client";

import { CheckIcon } from "@packages/icons";
import { useTranslation } from "react-i18next";
import { CTA_BENEFITS } from "../constants";

export function CtaBenefits() {
  const { t } = useTranslation("landing");

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-center gap-3.5 sm:gap-8 text-xs sm:text-sm text-muted-foreground font-medium border-t border-border dark:border-white/10 pt-8 max-w-2xl mx-auto w-fit sm:w-full text-left">
      {CTA_BENEFITS.map((benefitKey) => (
        <div
          key={benefitKey}
          className="flex items-start sm:items-center gap-2.5"
        >
          <CheckIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
          <span className="leading-snug">{t(benefitKey)}</span>
        </div>
      ))}
    </div>
  );
}
