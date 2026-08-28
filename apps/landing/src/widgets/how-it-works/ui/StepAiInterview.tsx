"use client";

import { useLandingTranslations } from "@/shared/lib";
import { ParticipantFeed } from "./ParticipantFeed";
import { StepHeader } from "./StepHeader";

export function StepAiInterview() {
  const { landing } = useLandingTranslations();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
      <div className="lg:col-span-6 lg:order-2 flex flex-col items-start">
        <StepHeader
          stepNumber="02"
          tag={landing.howItWorks.step2Tag}
          title={landing.howItWorks.step2Title}
          description={landing.howItWorks.step2Desc}
        />
        <ul className="space-y-3 text-sm text-slate-200">
          <li className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-bold shrink-0">
              ✓
            </div>
            <span>{landing.howItWorks.step2Check1}</span>
          </li>
          <li className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-bold shrink-0">
              ✓
            </div>
            <span>{landing.howItWorks.step2Check2}</span>
          </li>
          <li className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-bold shrink-0">
              ✓
            </div>
            <span>{landing.howItWorks.step2Check3}</span>
          </li>
        </ul>
      </div>

      <div className="lg:col-span-6 lg:order-1">
        <div className="glass-panel rounded-2xl p-4 border border-white/15 shadow-xl glow-card overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {/* Interviewer Feed */}
            <ParticipantFeed
              name={landing.howItWorks.aiInterviewer}
              roleBadge={landing.howItWorks.aiRole}
              avatarText="LEAD"
              micActiveText={landing.howItWorks.micActive}
              isLead={true}
            />

            {/* Candidate Feed */}
            <ParticipantFeed
              name={landing.howItWorks.candidateYou}
              avatarText="DEV"
              avatarGradient="bg-slate-800 border border-white/15 text-slate-300 shadow-md"
              micActiveText={landing.howItWorks.micActive}
              videoQualityText={landing.howItWorks.clearAudio}
              isLead={false}
            />
          </div>

          {/* Dialogue bubble */}
          <div className="p-3.5 rounded-xl bg-[#0a0c16] border border-white/10 text-xs text-slate-300 leading-relaxed shadow-sm">
            <span className="text-violet-400 font-semibold">
              {landing.howItWorks.dialogueSpeaker}
            </span>{" "}
            {landing.howItWorks.dialogueText}
          </div>
        </div>
      </div>
    </div>
  );
}
