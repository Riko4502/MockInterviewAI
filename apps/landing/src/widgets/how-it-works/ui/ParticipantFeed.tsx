"use client";

import { Avatar, Badge } from "@packages/ui";
import { cn } from "@packages/utils";

interface ParticipantFeedProps {
  name: string;
  roleBadge?: string;
  avatarText: string;
  avatarGradient?: string;
  micActiveText: string;
  videoQualityText?: string;
  isLead?: boolean;
}

export function ParticipantFeed({
  name,
  roleBadge,
  avatarText,
  avatarGradient = "bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/40 ring-4 ring-violet-500/20 text-white",
  micActiveText,
  videoQualityText = "1080p 60fps",
  isLead = false,
}: ParticipantFeedProps) {
  return (
    <div
      className={cn(
        "relative rounded-xl bg-slate-900/90 p-4 aspect-video flex flex-col justify-between overflow-hidden shadow-inner",
        isLead ? "border border-violet-500/40" : "border border-white/10",
      )}
    >
      {isLead && <div className="absolute inset-0 bg-radial-hero opacity-60" />}
      <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-300">
        <span className="flex items-center gap-1.5 font-medium text-white">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {name}
        </span>
        {roleBadge && (
          <Badge
            variant="statusInfo"
            className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-mono text-[10px] border border-violet-500/30"
          >
            {roleBadge}
          </Badge>
        )}
      </div>

      <div className="relative z-10 flex items-center justify-center py-2">
        <Avatar className="w-14 h-14">
          <Avatar.Fallback
            className={cn(
              "font-bold text-sm tracking-wide size-full flex items-center justify-center",
              avatarGradient,
            )}
          >
            {avatarText}
          </Avatar.Fallback>
        </Avatar>
      </div>

      <div className="relative z-10 flex items-center justify-between text-[10px] text-slate-400">
        <span className="flex items-center gap-1 text-emerald-400">
          ● {micActiveText}
        </span>
        <span className="text-violet-300 font-mono">{videoQualityText}</span>
      </div>
    </div>
  );
}
