"use client";

import { GlobeIcon } from "@packages/icons";
import { Badge, Card, Typography } from "@packages/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SANDBOX_REGIONS } from "../constants";

export function FeatureSandbox() {
  const { t } = useTranslation("landing");
  const [activeRegion, setActiveRegion] = useState("eu");

  return (
    <Card className="w-full h-full relative rounded-[28px] sm:rounded-[32px] p-5 sm:p-8 md:p-10 apple-glass border border-black/[0.08] dark:border-white/[0.08] flex flex-col justify-between group hover:border-cyan-500/30 dark:hover:border-cyan-400/30 transition-all duration-500 overflow-hidden ring-0">
      {/* Corner Ambient Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-600/10 dark:bg-cyan-600/15 blur-3xl pointer-events-none rounded-full transition-opacity group-hover:opacity-100 opacity-60" />

      <div className="mb-8 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-500 to-indigo-600 flex items-center justify-center text-white mb-6 shadow-lg shadow-cyan-600/25 group-hover:scale-105 transition-transform duration-300">
          <GlobeIcon className="w-6 h-6" />
        </div>
        <Typography.H3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-3">
          {t("features.card3Title")}
        </Typography.H3>
        <Typography.Lead className="text-muted-foreground text-sm sm:text-base font-normal leading-relaxed">
          {t("features.card3Desc")}
        </Typography.Lead>
      </div>

      <div className="relative z-10">
        <div className="grid grid-cols-3 gap-2.5 text-xs font-mono">
          {SANDBOX_REGIONS.map((reg) => (
            <button
              type="button"
              key={reg.id}
              aria-pressed={activeRegion === reg.id}
              onClick={() => setActiveRegion(reg.id)}
              className={`p-3 rounded-2xl border text-center cursor-pointer transition-all duration-200 ${
                activeRegion === reg.id
                  ? "bg-white dark:bg-[#12131e] border-cyan-500/50 shadow-lg shadow-cyan-500/10"
                  : "bg-black/[0.03] dark:bg-[#07070c]/80 border-black/[0.06] dark:border-white/[0.08] hover:border-cyan-500/30"
              }`}
            >
              <div className="text-[11px] text-muted-foreground font-medium">
                {reg.name}
              </div>
              <div className="text-sm text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                {reg.ping}
              </div>
              {activeRegion === reg.id && (
                <Badge
                  variant="statusSuccess"
                  className="mt-1 text-[9px] px-1.5 py-0 bg-cyan-500/15 border-cyan-500/30 text-cyan-700 dark:text-cyan-300"
                >
                  {reg.status}
                </Badge>
              )}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
