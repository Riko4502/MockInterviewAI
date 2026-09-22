"use client";

import { type Locale, messages } from "@packages/i18n";
import { ArrowRightIcon } from "@packages/icons";
import { NotFoundView as SharedNotFoundView } from "@packages/ui";
import NextLink from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { I18nClientProvider, normalizeBrowserLocale } from "@/shared/lib";

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
    <SharedNotFoundView
      badgeText={badgeText}
      title={titleText}
      description={descText}
      terminalFilename="session_stack_trace.log"
      codeComment={codeCommentText}
      codeError={`FatalError: [ERR_PAGE_NOT_FOUND] ${codeErrorText}`}
      actionElement={
        <NextLink
          href={homeUrl}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:via-indigo-500 hover:to-purple-500 text-white font-semibold text-sm shadow-xl shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 group"
        >
          <span>{backHomeText}</span>
          <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </NextLink>
      }
    />
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
