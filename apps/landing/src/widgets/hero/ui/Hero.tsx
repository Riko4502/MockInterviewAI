"use client";

import { ArrowRightIcon } from "@packages/icons";
import { Badge, Button } from "@packages/ui";
import { getRegisterUrl } from "@/shared/config";
import { useLandingTranslations } from "@/shared/lib";
import { HeroCodeMockup } from "./HeroCodeMockup";
import { HeroMetrics } from "./HeroMetrics";

export function Hero() {
  const { landing } = useLandingTranslations();
  const registerUrl = getRegisterUrl();

  return (
    <section className="relative pt-12 pb-20 md:pt-24 md:pb-36 overflow-hidden bg-grid-pattern">
      {/* Glowing Background Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-violet-600/20 blur-[140px] rounded-full pointer-events-none -z-10 animate-pulse-slow" />
      <div className="absolute top-1/3 left-1/4 w-[450px] h-[350px] bg-indigo-500/15 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-1/2 right-1/4 w-[350px] h-[250px] bg-purple-600/15 blur-[110px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          {/* Left Hero Content (7 cols) */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            <Badge
              variant="statusInfo"
              className="mb-6 bg-violet-500/10 border-violet-500/30 text-violet-300 font-semibold tracking-wider uppercase px-3.5 py-1.5"
            >
              {landing.hero.badge}
            </Badge>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12] mb-6">
              {landing.hero.title1} <br className="hidden sm:inline" />
              <span className="text-gradient-purple">
                {landing.hero.title2}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-slate-300 font-normal leading-relaxed mb-8 max-w-xl">
              {landing.hero.subtitle}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto mb-12">
              <Button
                asChild
                size="lg"
                className="w-full sm:w-auto rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-xl shadow-violet-600/30 hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all px-8 py-3.5 h-auto text-base font-semibold group gap-2.5"
              >
                <a href={registerUrl}>
                  <span>{landing.hero.ctaStart}</span>
                  <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </a>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full sm:w-auto rounded-full bg-white/5 hover:bg-white/10 border-white/10 text-slate-200 hover:text-white px-7 py-3.5 h-auto text-base font-semibold backdrop-blur-md"
              >
                <a href="#how-it-works">{landing.hero.ctaExplore}</a>
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
