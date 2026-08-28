"use client";

import { GlobeIcon } from "@packages/icons";
import { Card } from "@packages/ui";
import { useLandingTranslations } from "@/shared/lib";

export function FeatureSandbox() {
  const { landing } = useLandingTranslations();

  return (
    <Card className="md:col-span-5 glass-panel rounded-3xl p-8 border-white/10 flex flex-col justify-between group hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-950/40 transition-all duration-300">
      <Card.Header className="p-0">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600/30 to-blue-600/30 border border-sky-500/40 flex items-center justify-center text-sky-300 mb-6 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-sky-500/30 transition-all">
          <GlobeIcon className="w-6 h-6" />
        </div>
        <Card.Title className="text-xl sm:text-2xl font-bold text-white mb-3">
          {landing.features.card3Title}
        </Card.Title>
        <Card.Description className="text-slate-300 text-sm leading-relaxed mb-6">
          {landing.features.card3Desc}
        </Card.Description>
      </Card.Header>

      <Card.Content className="p-0">
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-3 rounded-xl bg-[#0a0c16] border border-white/10 text-center flex items-center justify-between">
            <span className="text-slate-400">EU-Central</span>
            <span className="text-emerald-400 font-bold">14ms</span>
          </div>
          <div className="p-3 rounded-xl bg-[#0a0c16] border border-white/10 text-center flex items-center justify-between">
            <span className="text-slate-400">US-East</span>
            <span className="text-emerald-400 font-bold">18ms</span>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}
