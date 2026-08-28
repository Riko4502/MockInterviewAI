"use client";

import { TrendUpIcon } from "@packages/icons";
import { Card } from "@packages/ui";
import { useLandingTranslations } from "@/shared/lib";

export function FeatureAnalytics() {
  const { landing } = useLandingTranslations();

  return (
    <Card className="md:col-span-7 glass-panel rounded-3xl p-8 border-white/10 flex flex-col justify-between group hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-950/40 transition-all duration-300">
      <Card.Header className="p-0 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600/30 to-teal-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-300 mb-6 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-emerald-500/30 transition-all">
          <TrendUpIcon className="w-6 h-6" />
        </div>
        <Card.Title className="text-xl sm:text-2xl font-bold text-white mb-3">
          {landing.features.card4Title}
        </Card.Title>
        <Card.Description className="text-slate-300 text-sm sm:text-base leading-relaxed">
          {landing.features.card4Desc}
        </Card.Description>
      </Card.Header>

      <Card.Content className="p-0">
        <div className="p-4 rounded-2xl bg-[#0a0c16] border border-white/10 grid grid-cols-3 gap-4 text-center shadow-inner font-mono">
          <div>
            <div className="text-2xl font-extrabold text-white">96.8%</div>
            <div className="text-[11px] text-slate-400 mt-1 font-sans">
              {landing.features.card4AlgoAccuracy}
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-violet-400">
              4.9 / 5.0
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-sans">
              {landing.features.card4SystemArch}
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-emerald-400">
              Top 3%
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-sans">
              {landing.features.card4GlobalBenchmark}
            </div>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}
