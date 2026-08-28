"use client";

import { HubConnectionIcon } from "@packages/icons";
import { Badge, Card } from "@packages/ui";
import { useLandingTranslations } from "@/shared/lib";

export function FeatureCollaboration() {
  const { landing } = useLandingTranslations();

  return (
    <Card className="md:col-span-7 glass-panel rounded-3xl p-8 border-white/10 flex flex-col justify-between group hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-950/40 transition-all duration-300">
      <Card.Header className="p-0 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600/30 to-indigo-600/30 border border-violet-500/40 flex items-center justify-center text-violet-300 mb-6 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-violet-500/30 transition-all">
          <HubConnectionIcon className="w-6 h-6" />
        </div>
        <Card.Title className="text-xl sm:text-2xl font-bold text-white mb-3">
          {landing.features.card1Title}
        </Card.Title>
        <Card.Description className="text-slate-300 text-sm sm:text-base leading-relaxed">
          {landing.features.card1Desc}
        </Card.Description>
      </Card.Header>

      <Card.Content className="p-0">
        <div className="rounded-2xl bg-[#0a0c16] border border-white/10 p-4 font-mono text-xs text-slate-300 shadow-inner">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10 text-[11px] text-slate-400">
            <span className="text-violet-400 font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-400" />
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
                className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 text-[10px]"
              >
                {landing.features.card1InterviewerTag}
              </Badge>
              <span className="text-slate-400">
                {landing.features.card1InterviewerAction}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-violet-950/40 border border-violet-500/30 text-violet-200 mt-2">
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
