"use client";

import { MicIcon } from "@packages/icons";
import { Card } from "@packages/ui";
import { useLandingTranslations } from "@/shared/lib";

export function FeatureVoice() {
  const { landing } = useLandingTranslations();

  return (
    <Card className="w-full h-full relative rounded-3xl p-8 border border-indigo-500/20 bg-gradient-to-b from-indigo-950/20 via-[#0c0e1a]/80 to-[#07080e]/90 backdrop-blur-xl flex flex-col justify-between group hover:border-indigo-500/60 hover:shadow-2xl hover:shadow-indigo-950/50 transition-all duration-300 overflow-hidden">
      {/* Corner Ambient Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/15 blur-3xl pointer-events-none rounded-full" />

      <Card.Header className="p-0 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 border border-indigo-400/40 flex items-center justify-center text-white mb-6 shadow-lg shadow-indigo-600/30 group-hover:scale-110 group-hover:shadow-indigo-500/50 transition-all">
          <MicIcon className="w-6 h-6" />
        </div>
        <Card.Title className="text-xl sm:text-2xl font-bold text-white mb-3">
          {landing.features.card2Title}
        </Card.Title>
        <Card.Description className="text-slate-300 text-sm leading-relaxed mb-6">
          {landing.features.card2Desc}
        </Card.Description>
      </Card.Header>

      <Card.Content className="p-0 relative z-10">
        <div className="p-4 rounded-2xl bg-[#0a0c16]/90 border border-indigo-500/20 flex items-center justify-between shadow-inner">
          <div>
            <div className="text-xs text-indigo-300">
              {landing.features.card2SpeakingPace}
            </div>
            <div className="text-xl font-bold text-white font-mono mt-0.5 flex items-center gap-2">
              <span>{landing.features.card2Wpm}</span>
              {/* Dynamic Sound Equalizer Waveform */}
              <div className="flex items-end gap-0.5 h-4">
                <span className="w-0.5 bg-indigo-400 rounded-full animate-equalizer-1" />
                <span className="w-0.5 bg-purple-400 rounded-full animate-equalizer-2" />
                <span className="w-0.5 bg-violet-400 rounded-full animate-equalizer-3" />
                <span className="w-0.5 bg-emerald-400 rounded-full animate-equalizer-4" />
                <span className="w-0.5 bg-indigo-400 rounded-full animate-equalizer-5" />
              </div>
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
