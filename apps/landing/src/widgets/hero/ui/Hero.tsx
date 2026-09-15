"use client";

import { ArrowRightIcon } from "@packages/icons";
import { Button, Typography } from "@packages/ui";
import NextLink from "next/link";
import { useTranslation } from "react-i18next";
import { getRegisterUrl } from "@/shared/config";
import { HeroCodeMockup } from "./HeroCodeMockup";
import { HeroMetrics } from "./HeroMetrics";

export function Hero() {
  const { t } = useTranslation("landing");
  const registerUrl = getRegisterUrl();

  return (
    <section className="relative pt-12 pb-20 md:pt-24 md:pb-36 overflow-hidden bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-12 items-center">
          {/* Left Hero Content (7 cols) */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            {/* Apple Intelligence Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full apple-badge-intelligence backdrop-blur-md mb-8 group transition-transform hover:scale-[1.02]">
              <span className="w-2 h-2 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 animate-pulse" />
              <span className="text-xs font-semibold text-gradient-intelligence tracking-wider uppercase">
                {t("hero.badge")}
              </span>
            </div>

            {/* Titanium Headline */}
            <Typography.H1 className="text-4xl sm:text-5xl lg:text-[62px] font-bold tracking-[-0.03em] text-foreground leading-[1.08] mb-6">
              <span className="text-gradient-titanium">{t("hero.title1")}</span>{" "}
              <br className="hidden sm:inline" />
              <span className="text-gradient-intelligence">
                {t("hero.title2")}
              </span>
            </Typography.H1>

            {/* Subtitle */}
            <Typography.Lead className="text-base sm:text-lg lg:text-xl text-muted-foreground font-normal leading-relaxed mb-10 max-w-xl">
              {t("hero.subtitle")}
            </Typography.Lead>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto mb-14">
              <Button
                asChild
                size="lg"
                className="w-full sm:w-auto rounded-full bg-foreground text-background hover:opacity-90 dark:bg-white dark:text-black dark:hover:bg-white/90 shadow-xl shadow-black/10 dark:shadow-white/10 hover:scale-[1.02] active:scale-[0.98] transition-all px-8 py-3.5 h-auto text-base font-semibold group gap-2.5 apple-glow-button"
              >
                <a href={registerUrl}>
                  <span>{t("hero.ctaStart")}</span>
                  <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </a>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full sm:w-auto rounded-full apple-glass text-foreground hover:bg-black/5 dark:hover:bg-white/10 px-7 py-3.5 h-auto text-base font-medium transition-all"
              >
                <NextLink href="#how-it-works">{t("hero.ctaExplore")}</NextLink>
              </Button>
            </div>

            {/* Metrics Strip */}
            <HeroMetrics />
          </div>

          {/* Right Hero Visual Mockup (5 cols) */}
          <div className="lg:col-span-5 relative mt-4 lg:mt-0">
            <HeroCodeMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
