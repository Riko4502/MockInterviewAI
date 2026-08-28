"use client";

import { TrendUpIcon } from "@packages/icons";
import { Card } from "@packages/ui";
import { useLandingTranslations } from "@/shared/lib";

export function FeatureAnalytics() {
  const { landing } = useLandingTranslations();

  return (
    <Card className="w-full h-full relative rounded-3xl p-8 border border-emerald-500/20 bg-gradient-to-b from-emerald-950/20 via-[#0c0e1a]/80 to-[#07080e]/90 backdrop-blur-xl flex flex-col justify-between group hover:border-emerald-500/60 hover:shadow-2xl hover:shadow-emerald-950/50 transition-all duration-300 overflow-hidden">
      {/* Corner Ambient Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-600/15 blur-3xl pointer-events-none rounded-full" />

      <Card.Header className="p-0 mb-6 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 border border-emerald-400/40 flex items-center justify-center text-white mb-6 shadow-lg shadow-emerald-600/30 group-hover:scale-110 group-hover:shadow-emerald-500/50 transition-all">
          <TrendUpIcon className="w-6 h-6" />
        </div>
        <Card.Title className="text-xl sm:text-2xl font-bold text-white mb-3">
          {landing.features.card4Title}
        </Card.Title>
        <Card.Description className="text-slate-300 text-sm sm:text-base leading-relaxed">
          {landing.features.card4Desc}
        </Card.Description>
      </Card.Header>

      <Card.Content className="p-0 relative z-10">
        <div className="p-4 rounded-2xl bg-[#0a0c16]/90 border border-emerald-500/20 grid grid-cols-3 gap-4 text-center shadow-inner font-mono">
          <div>
            <div className="text-2xl font-extrabold text-white">96.8%</div>
            <div className="text-[11px] text-emerald-300/80 mt-1 font-sans">
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
            <div className="text-[11px] text-emerald-300/80 mt-1 font-sans">
              {landing.features.card4GlobalBenchmark}
            </div>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}
