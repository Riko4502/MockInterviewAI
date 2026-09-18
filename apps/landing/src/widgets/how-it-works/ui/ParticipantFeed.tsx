"use client";

import { DotIcon } from "@packages/icons";
import { Avatar, Badge, Card } from "@packages/ui";
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
    <Card
      className={cn(
        "relative rounded-2xl p-4 aspect-video flex flex-col justify-between overflow-hidden group transition-all duration-300 backdrop-blur-xl shadow-none ring-0",
        "bg-black/[0.03] dark:bg-[#07070c]/90 border",
        isLead
          ? "border-rose-500/40 dark:border-rose-400/40 shadow-lg shadow-rose-500/5 dark:shadow-rose-950/40"
          : "border-black/[0.06] dark:border-white/[0.08]",
      )}
    >
      <div className="relative z-10 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5 font-semibold text-foreground min-w-0">
          <DotIcon className="w-3.5 h-3.5 text-emerald-500 animate-pulse shrink-0" />
          <span className="truncate">{name}</span>
        </span>
        {roleBadge && (
          <Badge
            variant="statusInfo"
            className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-300 font-mono text-[10px] border border-rose-500/25 whitespace-nowrap shrink-0"
          >
            {roleBadge}
          </Badge>
        )}
      </div>

      <div className="relative z-10 flex items-center justify-center py-2">
        <div className="relative">
          <Avatar className="w-14 h-14">
            <Avatar.Fallback
              className={cn(
                "font-bold text-sm tracking-wide size-full flex items-center justify-center transition-transform group-hover:scale-105",
                avatarGradient,
              )}
            >
              {avatarText}
            </Avatar.Fallback>
          </Avatar>
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
          <div className="flex items-end gap-0.5 h-3">
            <span className="w-0.5 bg-emerald-500 rounded-full animate-equalizer-1" />
            <span className="w-0.5 bg-emerald-500 rounded-full animate-equalizer-2" />
            <span className="w-0.5 bg-emerald-500 rounded-full animate-equalizer-3" />
            <span className="w-0.5 bg-emerald-500 rounded-full animate-equalizer-4" />
          </div>
          <span>{micActiveText}</span>
        </div>
        <span className="text-muted-foreground font-mono">
          {videoQualityText}
        </span>
      </div>
    </Card>
  );
}
