"use client";

import { GithubIcon } from "@packages/icons";
import { navigationConfig } from "@/shared/config";
import { useLandingTranslations } from "@/shared/lib";

export function FooterBottom() {
  const { landing } = useLandingTranslations();

  return (
    <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
      <div>
        © {new Date().getFullYear()} DEVSYNC, Inc. {landing.footer.rights}
      </div>
      <div className="flex items-center gap-4 text-slate-400">
        <a
          href={navigationConfig.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
          aria-label="GitHub Repository"
        >
          <GithubIcon className="w-4 h-4" />
          <span className="sr-only">GitHub</span>
        </a>
      </div>
    </div>
  );
}
