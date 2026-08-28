"use client";

import { Button } from "@packages/ui";
import { useEffect, useState } from "react";
import { useLandingTranslations } from "@/shared/lib";
import { ParticipantFeed } from "./ParticipantFeed";
import { StepHeader } from "./StepHeader";

export function StepAiInterview() {
  const { landing } = useLandingTranslations();
  const [activeSpeaker, setActiveSpeaker] = useState<"ai" | "candidate">("ai");
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveSpeaker((prev) => (prev === "ai" ? "candidate" : "ai"));
    }, 3200);
    return () => clearInterval(interval);
  }, [isPlaying]);

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
            <div className="w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 text-xs font-bold shrink-0">
              ✓
            </div>
            <span>{landing.howItWorks.step2Check1}</span>
          </li>
          <li className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 text-xs font-bold shrink-0">
              ✓
            </div>
            <span>{landing.howItWorks.step2Check2}</span>
          </li>
          <li className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 text-xs font-bold shrink-0">
              ✓
            </div>
            <span>{landing.howItWorks.step2Check3}</span>
          </li>
        </ul>
      </div>

      <div className="lg:col-span-6 lg:order-1">
        <div className="glass-panel rounded-2xl p-4 border border-rose-500/30 shadow-xl glow-card overflow-hidden bg-gradient-to-b from-rose-950/20 to-[#0a0c16]/90 relative">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-rose-600/15 blur-3xl pointer-events-none rounded-full" />

          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 text-xs relative z-10">
            <span className="font-mono text-rose-300 text-[11px] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              LIVE AUDIO STREAM
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setIsPlaying(!isPlaying)}
              className="text-[10px] font-mono text-rose-300 hover:text-white px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20"
            >
              {isPlaying ? "Pause Simulation ⏸" : "Resume Simulation ▶"}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 relative z-10">
            {/* Interviewer Feed */}
            <div
              className={`rounded-xl transition-all duration-300 ${
                activeSpeaker === "ai"
                  ? "ring-2 ring-rose-500 shadow-lg shadow-rose-950/60"
                  : "opacity-80"
              }`}
            >
              <ParticipantFeed
                name={landing.howItWorks.aiInterviewer}
                roleBadge={landing.howItWorks.aiRole}
                avatarText="LEAD"
                avatarGradient="bg-gradient-to-tr from-rose-600 to-pink-600 shadow-lg shadow-rose-600/40 ring-4 ring-rose-500/20 text-white"
                micActiveText={landing.howItWorks.micActive}
                isLead={activeSpeaker === "ai"}
              />
            </div>

            {/* Candidate Feed */}
            <div
              className={`rounded-xl transition-all duration-300 ${
                activeSpeaker === "candidate"
                  ? "ring-2 ring-emerald-500 shadow-lg shadow-emerald-950/60"
                  : "opacity-80"
              }`}
            >
              <ParticipantFeed
                name={landing.howItWorks.candidateYou}
                avatarText="DEV"
                avatarGradient={
                  activeSpeaker === "candidate"
                    ? "bg-gradient-to-tr from-emerald-600 to-teal-600 shadow-md shadow-emerald-600/40 text-white"
                    : "bg-slate-800 border border-white/15 text-slate-300 shadow-md"
                }
                micActiveText={landing.howItWorks.micActive}
                videoQualityText={landing.howItWorks.clearAudio}
                isLead={activeSpeaker === "candidate"}
              />
            </div>
          </div>

          {/* Dialogue bubble */}
          <div className="p-3.5 rounded-xl bg-[#0a0c16]/95 border border-rose-500/20 text-xs text-slate-300 leading-relaxed shadow-sm relative z-10">
            {activeSpeaker === "ai" ? (
              <div>
                <span className="text-rose-400 font-semibold">
                  {landing.howItWorks.dialogueSpeaker}:
                </span>{" "}
                <span>{landing.howItWorks.dialogueText}</span>
              </div>
            ) : (
              <div>
                <span className="text-emerald-400 font-semibold">
                  {landing.howItWorks.candidateYou}:
                </span>{" "}
                <span>
                  &ldquo;I propose using a doubly linked list combined with a
                  hash map to achieve O(1) get and put operations.&rdquo;
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
