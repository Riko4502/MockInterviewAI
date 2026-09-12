"use client";

import { GithubIcon } from "@packages/icons";
import { Typography } from "@packages/ui";
import NextLink from "next/link";
import { useTranslation } from "react-i18next";
import { FOOTER_SECTIONS } from "../constants";

export function FooterNavLinks() {
  const { t } = useTranslation("landing");

  return (
    <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
      {FOOTER_SECTIONS.map((section) => (
        <div key={section.key}>
          <Typography.H4 className="text-xs font-mono font-bold text-white uppercase tracking-wider mb-4 scroll-m-0">
            {section.getTitle(t)}
          </Typography.H4>
          <ul className="space-y-2.5 text-sm">
            {section.links.map((link) => (
              <li key={link.key}>
                {link.isExternal ? (
                  <a
                    href={link.getHref()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors flex items-center gap-1.5"
                  >
                    {link.icon === "github" && (
                      <GithubIcon className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    {link.getLabel(t)}
                  </a>
                ) : (
                  <NextLink
                    href={link.getHref()}
                    className="hover:text-white transition-colors flex items-center gap-1.5"
                  >
                    {link.getLabel(t)}
                  </NextLink>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
