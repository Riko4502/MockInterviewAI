"use client";

import { type Locale, messages } from "@packages/i18n";
import { ArrowRightIcon } from "@packages/icons";
import { Typography } from "@packages/ui";
import NextLink from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { I18nClientProvider, normalizeBrowserLocale } from "@/shared/lib";
import { DynamicBackground, GlobalSpotlight } from "@/shared/ui";

function NotFoundContent({ locale }: { locale: Locale }) {
  const { t } = useTranslation("landing");

  const isEn = locale === "en";
  const homeUrl = isEn ? "/en/" : "/";

  // Translations pulled from @packages/i18n
  const dict = messages[locale].landing;

  const badgeText = t("notFound.badge", dict.notFound.badge);
  const titleText = t("notFound.title", dict.notFound.title);
  const descText = t("notFound.description", dict.notFound.description);
  const backHomeText = t("notFound.backHome", dict.notFound.backHome);
  const codeCommentText = t("notFound.codeComment", dict.notFound.codeComment);
  const codeErrorText = t("notFound.codeError", dict.notFound.codeError);

  return (
    <div className="min-h-screen text-slate-100 flex flex-col font-sans relative selection:bg-violet-500/30 selection:text-white bg-[#06070d] overflow-x-hidden">
      {/* Dynamic Animated Background with Neon Orbs & Cyber Grid */}
      <DynamicBackground />
      {/* Interactive Cursor Spotlight */}
      <GlobalSpotlight />

      {/* Center 404 Hero Container */}
      <main className="flex-1 relative z-10 flex items-center justify-center px-4 py-16 sm:py-24">
        {/* Ambient Center Glow */}
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-violet-600/20 via-purple-600/15 to-sky-500/10 rounded-full blur-[140px] pointer-events-none -z-10"
        />

        <div className="text-center max-w-2xl mx-auto space-y-6">
          {/* Cyber Status Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 backdrop-blur-md text-xs font-semibold tracking-wider text-violet-400 uppercase">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
            </span>
            {badgeText}
          </div>

          {/* Large Floating 404 Display */}
          <div className="relative select-none py-1">
            <span className="text-8xl sm:text-9xl md:text-[11rem] font-black tracking-tighter text-gradient-purple drop-shadow-[0_0_40px_rgba(168,85,247,0.35)] animate-float inline-block">
              404
            </span>
          </div>

          {/* Heading */}
          <Typography.H1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            {titleText}
          </Typography.H1>

          {/* Description */}
          <p className="text-slate-400 text-sm sm:text-base md:text-lg max-w-lg mx-auto leading-relaxed">
            {descText}
          </p>

          {/* Terminal / Code Log Card */}
          <div className="mt-8 mx-auto max-w-lg rounded-2xl glass-panel border border-white/10 p-5 text-left font-mono text-xs sm:text-sm shadow-2xl relative overflow-hidden group">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3 text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                <span className="ml-2 text-slate-400 text-[11px]">
                  session_stack_trace.log
                </span>
              </div>
              <span className="text-[10px] text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
                HTTP 404
              </span>
            </div>
            <div className="space-y-1.5 text-slate-300">
              <div className="flex items-start gap-2">
                <span className="text-violet-400 select-none">&gt;</span>
                <span>
                  <span className="text-pink-400">const</span> targetNode ={" "}
                  <span className="text-indigo-400">Router</span>.
                  <span className="text-cyan-400">resolve</span>(pathname);
                </span>
              </div>
              <div className="flex items-start gap-2 text-slate-500 italic">
                <span className="select-none">{"//"}</span>
                <span>{codeCommentText}</span>
              </div>
              <div className="flex items-start gap-2 text-rose-400">
                <span className="select-none">!</span>
                <span>
                  FatalError:{" "}
                  <span className="text-rose-300 font-semibold">
                    [ERR_PAGE_NOT_FOUND]
                  </span>{" "}
                  {codeErrorText}
                </span>
              </div>
            </div>
          </div>

          {/* Actions & Quick Links */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            <NextLink
              href={homeUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:via-indigo-500 hover:to-purple-500 text-white font-semibold text-sm shadow-xl shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 group"
            >
              <span>{backHomeText}</span>
              <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </NextLink>
          </div>
        </div>
      </main>
    </div>
  );
}

export function NotFoundView() {
  const [locale, setLocale] = useState<Locale>("ru");

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.pathname.startsWith("/en")) {
        setLocale("en");
      } else {
        const preferred = normalizeBrowserLocale();
        if (preferred === "en") {
          setLocale("en");
        }
      }
    }
  }, []);

  return (
    <I18nClientProvider locale={locale}>
      <NotFoundContent locale={locale} />
    </I18nClientProvider>
  );
}
