"use client";

import type { LanguageId, Theme } from "@packages/editor";
import type { InterviewTask } from "../model/types";
import { SandboxHeaderActions } from "./SandboxHeaderActions";
import { SandboxHeaderTaskSelector } from "./SandboxHeaderTaskSelector";
import { SandboxHeaderTimer } from "./SandboxHeaderTimer";

interface SandboxHeaderProps {
  tasks: InterviewTask[];
  currentTaskId: string;
  onTaskChange: (taskId: string) => void;
  language: LanguageId;
  onLanguageChange: (lang: LanguageId) => void;
  theme: Theme;
  onThemeToggle: () => void;
  timerSeconds: number;
  isTimerRunning: boolean;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onResetCode: () => void;
  onRunCode: () => void;
  isRunning: boolean;
  isVideoOpen: boolean;
  onToggleVideo: () => void;
  peerCount: number;
  isInCall: boolean;
  onCopyInvite: () => void;
  isInviteCopied: boolean;
}

export function SandboxHeader({
  tasks,
  currentTaskId,
  onTaskChange,
  language,
  onLanguageChange,
  theme,
  onThemeToggle,
  timerSeconds,
  isTimerRunning,
  onToggleTimer,
  onResetTimer,
  onResetCode,
  onRunCode,
  isRunning,
  isVideoOpen,
  onToggleVideo,
  peerCount,
  isInCall,
  onCopyInvite,
  isInviteCopied,
}: SandboxHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/60 px-4 backdrop-blur-md">
      <SandboxHeaderTaskSelector
        tasks={tasks}
        currentTaskId={currentTaskId}
        onTaskChange={onTaskChange}
        peerCount={peerCount}
        onCopyInvite={onCopyInvite}
        isInviteCopied={isInviteCopied}
      />

      <SandboxHeaderTimer
        timerSeconds={timerSeconds}
        isTimerRunning={isTimerRunning}
        onToggleTimer={onToggleTimer}
        onResetTimer={onResetTimer}
      />

      <SandboxHeaderActions
        language={language}
        onLanguageChange={onLanguageChange}
        theme={theme}
        onThemeToggle={onThemeToggle}
        onResetCode={onResetCode}
        onRunCode={onRunCode}
        isRunning={isRunning}
        isVideoOpen={isVideoOpen}
        onToggleVideo={onToggleVideo}
        isInCall={isInCall}
      />
    </header>
  );
}
