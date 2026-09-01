"use client";

import type { getMessages } from "@packages/i18n";
import { GithubIcon } from "@packages/icons";
import type { ReactNode } from "react";
import { getAppUrl, getAuthUrl, navigationConfig } from "@/shared/config";
import { useLandingTranslations } from "@/shared/lib";

type LandingMessages = ReturnType<typeof getMessages>["landing"];

interface FooterLinkItem {
  key: string;
  getLabel: (messages: LandingMessages) => string;
  getHref: () => string;
  icon?: ReactNode;
  isExternal?: boolean;
}

interface FooterSection {
  key: string;
  getTitle: (messages: LandingMessages) => string;
  links: FooterLinkItem[];
}

const FOOTER_SECTIONS: readonly FooterSection[] = [
  {
    key: "product",
    getTitle: (t) => t.footer.colProduct,
    links: [
      {
        key: "how-it-works",
        getLabel: (t) => t.nav.howItWorks,
        getHref: () => "#how-it-works",
      },
      {
        key: "features",
        getLabel: (t) => t.nav.features,
        getHref: () => "#features",
      },
      {
        key: "start",
        getLabel: (t) => t.hero.ctaStart,
        getHref: getAuthUrl,
      },
    ],
  },
  {
    key: "resources",
    getTitle: (t) => t.footer.colResources,
    links: [
      {
        key: "docs",
        getLabel: (t) => t.footer.docs,
        getHref: () => getAppUrl("/docs"),
      },
      {
        key: "guides",
        getLabel: (t) => t.footer.guides,
        getHref: () => getAppUrl("/guides"),
      },
      {
        key: "system-design",
        getLabel: (t) => t.footer.systemDesign,
        getHref: () => getAppUrl("/system-design"),
      },
    ],
  },
  {
    key: "company",
    getTitle: (t) => t.footer.colCompany,
    links: [
      {
        key: "about",
        getLabel: (t) => t.footer.about,
        getHref: () => getAppUrl("/about"),
      },
      {
        key: "github",
        getLabel: () => "GitHub",
        getHref: () => navigationConfig.githubUrl,
        icon: <GithubIcon className="w-3.5 h-3.5 text-slate-400" />,
        isExternal: true,
      },
    ],
  },
  {
    key: "legal",
    getTitle: (t) => t.footer.colLegal,
    links: [
      {
        key: "privacy",
        getLabel: (t) => t.footer.privacy,
        getHref: () => getAppUrl("/privacy"),
      },
      {
        key: "terms",
        getLabel: (t) => t.footer.terms,
        getHref: () => getAppUrl("/terms"),
      },
      {
        key: "security",
        getLabel: (t) => t.footer.security,
        getHref: () => getAppUrl("/security"),
      },
    ],
  },
];

export function FooterNavLinks() {
  const { landing } = useLandingTranslations();

  return (
    <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
      {FOOTER_SECTIONS.map((section) => (
        <div key={section.key}>
          <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider mb-4">
            {section.getTitle(landing)}
          </h4>
          <ul className="space-y-2.5 text-sm">
            {section.links.map((link) => (
              <li key={link.key}>
                <a
                  href={link.getHref()}
                  target={link.isExternal ? "_blank" : undefined}
                  rel={link.isExternal ? "noopener noreferrer" : undefined}
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  {link.icon}
                  {link.getLabel(landing)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
