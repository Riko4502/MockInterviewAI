"use client";

import { CheckIcon, DotIcon, PauseIcon, PlayIcon } from "@packages/icons";
import { Button, Card } from "@packages/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AI_INTERVIEW_CHECKLIST } from "../constants";
import { ParticipantFeed } from "./ParticipantFeed";
import { StepHeader } from "./StepHeader";

export function StepAiInterview() {
  const { t } = useTranslation("landing");
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
          tag={t("howItWorks.step2Tag")}
          title={t("howItWorks.step2Title")}
          description={t("howItWorks.step2Desc")}
        />
        <ul className="space-y-3 text-sm text-foreground">
          {AI_INTERVIEW_CHECKLIST.map((key) => (
            <li key={key} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <CheckIcon className="w-3 h-3" />
              </div>
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="lg:col-span-6 lg:order-1">
        <Card className="apple-glass rounded-[28px] p-5 sm:p-6 border border-black/[0.08] dark:border-white/[0.08] shadow-2xl relative overflow-hidden backdrop-blur-2xl ring-0">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-rose-600/10 dark:bg-rose-600/15 blur-3xl pointer-events-none rounded-full" />

          <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-black/[0.06] dark:border-white/[0.08] text-xs relative z-10">
            <span className="font-mono text-rose-600 dark:text-rose-400 text-[11px] font-semibold flex items-center gap-2">
              <DotIcon className="w-4 h-4 text-rose-500 animate-pulse" />
              {t("howItWorks.liveAudioStream")}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setIsPlaying(!isPlaying)}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] flex items-center gap-1.5"
            >
              {isPlaying ? (
                <>
                  <PauseIcon className="w-3 h-3" />
                  <span>{t("howItWorks.pauseSimulation")}</span>
                </>
              ) : (
                <>
                  <PlayIcon className="w-3 h-3 fill-current" />
                  <span>{t("howItWorks.resumeSimulation")}</span>
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 relative z-10">
            {/* Interviewer Feed */}
            <div
              className={`rounded-2xl transition-all duration-300 ${
                activeSpeaker === "ai"
                  ? "ring-2 ring-rose-500/80 shadow-lg shadow-rose-500/10 dark:shadow-rose-950/60"
                  : "opacity-80"
              }`}
            >
              <ParticipantFeed
                name={t("howItWorks.aiInterviewer")}
                roleBadge={t("howItWorks.aiRole")}
                avatarText="LEAD"
                avatarGradient="bg-gradient-to-tr from-rose-600 to-pink-600 shadow-lg shadow-rose-600/30 text-white"
                micActiveText={t("howItWorks.micActive")}
                isLead={activeSpeaker === "ai"}
              />
            </div>

            {/* Candidate Feed */}
            <div
              className={`rounded-2xl transition-all duration-300 ${
                activeSpeaker === "candidate"
                  ? "ring-2 ring-emerald-500/80 shadow-lg shadow-emerald-500/10 dark:shadow-emerald-950/60"
                  : "opacity-80"
              }`}
            >
              <ParticipantFeed
                name={t("howItWorks.candidateYou")}
                avatarText="DEV"
                avatarGradient={
                  activeSpeaker === "candidate"
                    ? "bg-gradient-to-tr from-emerald-600 to-teal-600 shadow-md shadow-emerald-600/30 text-white"
                    : "bg-black/[0.06] dark:bg-white/[0.1] border border-black/[0.08] dark:border-white/10 text-foreground shadow-sm"
                }
                micActiveText={t("howItWorks.micActive")}
                videoQualityText={t("howItWorks.clearAudio")}
                isLead={activeSpeaker === "candidate"}
              />
            </div>
          </div>

          {/* Dialogue bubble */}
          <Card className="p-4 rounded-2xl bg-black/[0.03] dark:bg-[#07070c]/90 border border-black/[0.06] dark:border-white/[0.08] text-xs text-foreground leading-relaxed backdrop-blur-xl relative z-10 shadow-none ring-0">
            {activeSpeaker === "ai" ? (
              <div>
                <span className="text-rose-600 dark:text-rose-400 font-semibold mr-1.5">
                  {t("howItWorks.dialogueSpeaker")}:
                </span>
                <span>{t("howItWorks.dialogueText")}</span>
              </div>
            ) : (
              <div>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold mr-1.5">
                  {t("howItWorks.candidateYou")}:
                </span>
                <span>{t("howItWorks.candidateDialogueText")}</span>
              </div>
            )}
          </Card>
        </Card>
      </div>
    </div>
  );
}
