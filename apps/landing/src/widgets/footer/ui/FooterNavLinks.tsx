"use client";

import { GithubIcon } from "@packages/icons";
import { useTranslation } from "react-i18next";
import { FOOTER_SECTIONS } from "../constants";

export function FooterNavLinks() {
  const { t } = useTranslation("landing");

  return (
    <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
      {FOOTER_SECTIONS.map((section) => (
        <div key={section.key}>
          <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider mb-4">
            {section.getTitle(t)}
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
                  {link.icon === "github" && (
                    <GithubIcon className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  {link.getLabel(t)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
