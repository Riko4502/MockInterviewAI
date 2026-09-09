import type { TFunction } from "i18next";
import { getAppUrl, getAuthUrl, navigationConfig } from "@/shared/config";

export type TranslationFn = TFunction<"landing">;

export interface FooterLinkItem {
  key: string;
  getLabel: (t: TranslationFn) => string;
  getHref: () => string;
  icon?: "github";
  isExternal?: boolean;
}

export interface FooterSection {
  key: string;
  getTitle: (t: TranslationFn) => string;
  links: FooterLinkItem[];
}

export const FOOTER_SECTIONS: readonly FooterSection[] = [
  {
    key: "product",
    getTitle: (t) => t("footer.colProduct"),
    links: [
      {
        key: "how-it-works",
        getLabel: (t) => t("nav.howItWorks"),
        getHref: () => "#how-it-works",
      },
      {
        key: "features",
        getLabel: (t) => t("nav.features"),
        getHref: () => "#features",
      },
      {
        key: "start",
        getLabel: (t) => t("hero.ctaStart"),
        getHref: getAuthUrl,
      },
    ],
  },
  {
    key: "resources",
    getTitle: (t) => t("footer.colResources"),
    links: [
      {
        key: "docs",
        getLabel: (t) => t("footer.docs"),
        getHref: () => getAppUrl("/docs"),
      },
      {
        key: "guides",
        getLabel: (t) => t("footer.guides"),
        getHref: () => getAppUrl("/guides"),
      },
      {
        key: "system-design",
        getLabel: (t) => t("footer.systemDesign"),
        getHref: () => getAppUrl("/system-design"),
      },
    ],
  },
  {
    key: "company",
    getTitle: (t) => t("footer.colCompany"),
    links: [
      {
        key: "about",
        getLabel: (t) => t("footer.about"),
        getHref: () => getAppUrl("/about"),
      },
      {
        key: "github",
        getLabel: () => "GitHub",
        getHref: () => navigationConfig.githubUrl,
        icon: "github",
        isExternal: true,
      },
    ],
  },
  {
    key: "legal",
    getTitle: (t) => t("footer.colLegal"),
    links: [
      {
        key: "privacy",
        getLabel: (t) => t("footer.privacy"),
        getHref: () => getAppUrl("/privacy"),
      },
      {
        key: "terms",
        getLabel: (t) => t("footer.terms"),
        getHref: () => getAppUrl("/terms"),
      },
      {
        key: "security",
        getLabel: (t) => t("footer.security"),
        getHref: () => getAppUrl("/security"),
      },
    ],
  },
];
