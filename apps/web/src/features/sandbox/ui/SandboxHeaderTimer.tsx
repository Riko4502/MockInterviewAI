"use client";

import { ClockIcon, UndoIcon } from "@packages/icons";
import { Button, Typography } from "@packages/ui";

interface SandboxHeaderTimerProps {
  timerSeconds: number;
  isTimerRunning: boolean;
  onToggleTimer: () => void;
  onResetTimer: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function SandboxHeaderTimer({
  timerSeconds,
  isTimerRunning,
  onToggleTimer,
  onResetTimer,
}: SandboxHeaderTimerProps) {
  const isTimerLow = timerSeconds < 5 * 60; // меньше 5 минут

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background/80 px-3 py-1 shadow-2xs">
      <ClockIcon
        className={`size-4 ${
          isTimerLow
            ? "animate-pulse text-destructive"
            : isTimerRunning
              ? "text-primary"
              : "text-muted-foreground"
        }`}
      />
      <Typography.Code
        className={`font-mono text-sm font-semibold ${
          isTimerLow ? "text-destructive" : "text-foreground"
        }`}
      >
        {formatTime(timerSeconds)}
      </Typography.Code>
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleTimer}
        className="h-6 px-1.5 text-[11px]"
      >
        {isTimerRunning ? "Пауза" : "Старт"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onResetTimer}
        className="h-6 px-1 text-[11px] text-muted-foreground"
        title="Сбросить таймер (45 мин)"
      >
        <UndoIcon className="size-3" />
      </Button>
    </div>
  );
}
