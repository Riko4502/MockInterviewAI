"use client";

import { MicIcon } from "@packages/icons";
import { Card } from "@packages/ui";
import { useLandingTranslations } from "@/shared/lib";

export function FeatureVoice() {
  const { landing } = useLandingTranslations();

  return (
    <Card className="md:col-span-5 glass-panel rounded-3xl p-8 border-white/10 flex flex-col justify-between group hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-950/40 transition-all duration-300">
      <Card.Header className="p-0">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600/30 to-purple-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 mb-6 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-indigo-500/30 transition-all">
          <MicIcon className="w-6 h-6" />
        </div>
        <Card.Title className="text-xl sm:text-2xl font-bold text-white mb-3">
          {landing.features.card2Title}
        </Card.Title>
        <Card.Description className="text-slate-300 text-sm leading-relaxed mb-6">
          {landing.features.card2Desc}
        </Card.Description>
      </Card.Header>

      <Card.Content className="p-0">
        <div className="p-4 rounded-2xl bg-[#0a0c16] border border-white/10 flex items-center justify-between shadow-inner">
          <div>
            <div className="text-xs text-slate-400">
              {landing.features.card2SpeakingPace}
            </div>
            <div className="text-xl font-bold text-white font-mono mt-0.5">
              {landing.features.card2Wpm}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">
              {landing.features.card2FillerWords}
            </div>
            <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
              {landing.features.card2Optimal}
            </div>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}
