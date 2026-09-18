"use client";

import { ClockIcon, UndoIcon } from "@packages/icons";
import { Button, Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { useSandboxStore } from "../model/useSandboxStore";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function SandboxHeaderTimer() {
  const { t } = useTranslation("interview");
  const timerSeconds = useSandboxStore((s) => s.timerSeconds);
  const isTimerRunning = useSandboxStore((s) => s.isTimerRunning);
  const toggleTimer = useSandboxStore((s) => s.toggleTimer);
  const resetTimer = useSandboxStore((s) => s.resetTimer);

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
        onClick={toggleTimer}
        className="h-6 px-1.5 text-[11px]"
      >
        {isTimerRunning
          ? t("sandbox.header.timerPause")
          : t("sandbox.header.timerStart")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={resetTimer}
        className="h-6 px-1 text-[11px] text-muted-foreground"
        title={t("sandbox.header.timerResetTooltip")}
      >
        <UndoIcon className="size-3" />
      </Button>
    </div>
  );
}
