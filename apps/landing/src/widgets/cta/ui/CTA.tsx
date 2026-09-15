"use client";

import { ArrowRightIcon } from "@packages/icons";
import { Button, Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";
import { getRegisterUrl } from "@/shared/config";
import { CtaBenefits } from "./CtaBenefits";

export function CTA() {
  const { t } = useTranslation("landing");
  const registerUrl = getRegisterUrl();

  return (
    <section
      id="cta"
      className="relative py-24 md:py-36 overflow-hidden bg-transparent"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Apple Spotlight Grand Portal Card */}
        <div className="relative rounded-[28px] sm:rounded-[36px] p-6 sm:p-14 md:p-20 apple-glass border border-black/[0.08] dark:border-white/[0.12] overflow-hidden shadow-2xl text-center">
          {/* Ambient Multi-Color Aurora Spotlight Flare */}
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[850px] h-[400px] bg-gradient-to-r from-pink-500/20 via-purple-600/25 to-cyan-500/20 dark:from-pink-500/30 dark:via-purple-600/35 dark:to-cyan-400/30 blur-[140px] pointer-events-none -z-10" />

          {/* Apple Intelligence Badge */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full apple-badge-intelligence backdrop-blur-md mb-6 sm:mb-8 group transition-transform hover:scale-[1.02]">
              <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 animate-pulse" />
              <span className="text-xs font-semibold text-gradient-intelligence tracking-wider uppercase">
                {t("cta.badge")}
              </span>
            </div>
          </div>

          {/* Grand Headline */}
          <Typography.H2 className="border-b-0 pb-0 text-2xl sm:text-5xl md:text-6xl font-bold tracking-[-0.03em] max-w-3xl mx-auto mb-4 sm:mb-6 leading-[1.15] sm:leading-[1.1]">
            <span className="text-gradient-titanium">{t("cta.title")}</span>
          </Typography.H2>

          {/* Subtitle */}
          <Typography.Lead className="text-sm sm:text-lg lg:text-xl text-muted-foreground font-normal max-w-2xl mx-auto mb-8 sm:mb-12 leading-relaxed">
            {t("cta.subtitle")}
          </Typography.Lead>

          {/* Action Button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto rounded-full bg-foreground text-background hover:opacity-90 dark:bg-white dark:text-black dark:hover:bg-white/90 shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all px-10 py-4 h-auto text-base font-semibold group gap-2.5 apple-glow-button"
            >
              <a href={registerUrl}>
                <span>{t("cta.button")}</span>
                <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
          </div>

          {/* Key Benefits List */}
          <CtaBenefits />
        </div>
      </div>
    </section>
  );
}
