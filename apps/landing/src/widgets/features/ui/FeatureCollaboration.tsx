"use client";

import { HubConnectionIcon } from "@packages/icons";
import { Badge, Card } from "@packages/ui";
import { useLandingTranslations } from "@/shared/lib";

export function FeatureCollaboration() {
  const { landing } = useLandingTranslations();

  return (
    <Card className="w-full h-full relative rounded-3xl p-8 border border-violet-500/20 bg-gradient-to-b from-violet-950/20 via-[#0c0e1a]/80 to-[#07080e]/90 backdrop-blur-xl flex flex-col justify-between group hover:border-violet-500/60 hover:shadow-2xl hover:shadow-violet-950/50 transition-all duration-300 overflow-hidden">
      {/* Corner Ambient Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-violet-600/15 blur-3xl pointer-events-none rounded-full" />

      <Card.Header className="p-0 mb-8 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 border border-violet-400/40 flex items-center justify-center text-white mb-6 shadow-lg shadow-violet-600/30 group-hover:scale-110 group-hover:shadow-violet-500/50 transition-all">
          <HubConnectionIcon className="w-6 h-6" />
        </div>
        <Card.Title className="text-xl sm:text-2xl font-bold text-white mb-3">
          {landing.features.card1Title}
        </Card.Title>
        <Card.Description className="text-slate-300 text-sm sm:text-base leading-relaxed">
          {landing.features.card1Desc}
        </Card.Description>
      </Card.Header>

      <Card.Content className="p-0 relative z-10">
        <div className="rounded-2xl bg-[#0a0c16]/90 border border-violet-500/20 p-4 font-mono text-xs text-slate-300 shadow-inner">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10 text-[11px] text-slate-400">
            <span className="text-violet-400 font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
              {landing.features.card1AiCopilot}
            </span>
            <span className="text-emerald-400 font-mono">
              {landing.features.card1Synced}
            </span>
          </div>
          <div className="space-y-1.5 text-slate-300">
            <div className="flex items-center gap-2">
              <Badge
                variant="statusInfo"
                className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 text-[10px] border border-violet-500/30"
              >
                {landing.features.card1InterviewerTag}
              </Badge>
              <span className="text-slate-400">
                {landing.features.card1InterviewerAction}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-violet-950/60 border border-violet-500/40 text-violet-200 mt-2">
              💡{" "}
              <span className="font-semibold">
                {landing.features.card1HintLabel}
              </span>{" "}
              {landing.features.card1HintText}
            </div>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}
