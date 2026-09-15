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
    <Card className="w-full h-full relative rounded-3xl p-8 border border-slate-200/80 dark:border-sky-500/20 bg-white/70 dark:bg-gradient-to-b dark:from-sky-950/20 dark:via-[#0c0e1a]/80 dark:to-[#07080e]/90 backdrop-blur-xl flex flex-col justify-between group hover:border-sky-500/40 hover:shadow-2xl hover:shadow-sky-500/10 dark:hover:shadow-sky-950/50 transition-all duration-300 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none">
      {/* Corner Ambient Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-sky-600/10 dark:bg-sky-600/15 blur-3xl pointer-events-none rounded-full" />

      <Card.Header className="p-0 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 border border-sky-400/40 flex items-center justify-center text-white mb-6 shadow-lg shadow-sky-600/30 group-hover:scale-110 group-hover:shadow-sky-500/50 transition-all">
          <GlobeIcon className="w-6 h-6" />
        </div>
        <Typography.H3 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
          {t("features.card3Title")}
        </Typography.H3>
        <Card.Description className="text-muted-foreground text-sm leading-relaxed mb-6">
          {t("features.card3Desc")}
        </Card.Description>
      </Card.Header>

      <Card.Content className="p-0 relative z-10">
        <div className="grid grid-cols-3 gap-2 text-xs font-mono">
          {SANDBOX_REGIONS.map((reg) => (
            <button
              type="button"
              key={reg.id}
              onClick={() => setActiveRegion(reg.id)}
              className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                activeRegion === reg.id
                  ? "bg-sky-50 dark:bg-sky-950/60 border-sky-400 shadow-md shadow-sky-500/10 dark:shadow-sky-950/50"
                  : "bg-slate-50/90 dark:bg-[#0a0c16]/90 border-slate-200/80 dark:border-white/10 hover:border-sky-400/50"
              }`}
            >
              <div className="text-[10px] text-sky-700 dark:text-sky-200 font-medium">
                {reg.name}
              </div>
              <div className="text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                {reg.ping}
              </div>
              {activeRegion === reg.id && (
                <Badge
                  variant="statusSuccess"
                  className="mt-1 text-[9px] px-1 py-0 bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300"
                >
                  {reg.status}
                </Badge>
              )}
            </button>
          ))}
        </div>
      </Card.Content>
    </Card>
  );
}
