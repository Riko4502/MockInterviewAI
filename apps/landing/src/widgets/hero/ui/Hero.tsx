"use client";

import { ArrowRightIcon } from "@packages/icons";
import { Badge, Button, Typography } from "@packages/ui";
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          {/* Left Hero Content (7 cols) */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            <Badge
              variant="statusInfo"
              className="mb-6 bg-violet-500/15 border-violet-500/30 text-violet-300 font-semibold tracking-wider uppercase px-3.5 py-1.5 shadow-sm shadow-violet-500/20"
            >
              {t("hero.badge")}
            </Badge>

            {/* Headline */}
            <Typography.H1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12] mb-6">
              {t("hero.title1")} <br className="hidden sm:inline" />
              <span className="text-gradient-purple">{t("hero.title2")}</span>
            </Typography.H1>

            {/* Subtitle */}
            <Typography.Lead className="text-lg sm:text-xl text-slate-300 font-normal leading-relaxed mb-8 max-w-xl">
              {t("hero.subtitle")}
            </Typography.Lead>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto mb-12">
              <Button
                asChild
                size="lg"
                className="w-full sm:w-auto rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-xl shadow-violet-600/30 hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all px-8 py-3.5 h-auto text-base font-semibold group gap-2.5"
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
                className="w-full sm:w-auto rounded-full bg-white/5 hover:bg-white/10 border-white/10 text-slate-200 hover:text-white px-7 py-3.5 h-auto text-base font-semibold backdrop-blur-md"
              >
                <NextLink href="#how-it-works">{t("hero.ctaExplore")}</NextLink>
              </Button>
            </div>

            {/* Metrics Strip */}
            <HeroMetrics />
          </div>

          {/* Right Hero Visual Mockup (5 cols) */}
          <div className="lg:col-span-5 relative">
            <HeroCodeMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
