"use client";

import { WandIcon } from "@packages/icons";
import { Button, Typography } from "@packages/ui";
import type { InterviewTask } from "../model/types";

interface SandboxTaskHintsProps {
  task: InterviewTask;
  revealedHints: number;
  onRevealNextHint: () => void;
}

export function SandboxTaskHints({
  task,
  revealedHints,
  onRevealNextHint,
}: SandboxTaskHintsProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4 text-xs text-purple-300">
        <div className="flex items-center gap-2 font-semibold">
          <WandIcon className="size-4 text-purple-400" />
          Виртуальный AI-интервьюер
        </div>
        <Typography.Muted className="mt-1 text-purple-300/80">
          Если вы застряли во время решения, открывайте подсказки
          последовательно, как на реальном техническом собеседовании.
        </Typography.Muted>
      </div>

      <div className="space-y-3">
        {task.hints.map((hint, idx) => {
          const isRevealed = idx < revealedHints;
          return (
            <div
              key={`hint-${idx}-${hint.slice(0, 10)}`}
              className={`rounded-lg border p-4 transition-all duration-200 ${
                isRevealed
                  ? "border-purple-500/30 bg-purple-500/5 text-foreground"
                  : "border-border/60 bg-muted/20 text-muted-foreground opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">
                  Подсказка #{idx + 1}
                </span>
                {isRevealed && (
                  <span className="text-[10px] text-purple-400 font-medium">
                    Открыта ✓
                  </span>
                )}
              </div>
              <div className="mt-2 text-xs leading-relaxed">
                {isRevealed ? hint : "🔒 Нажмите кнопку ниже, чтобы открыть"}
              </div>
            </div>
          );
        })}
      </div>

      {revealedHints < task.hints.length && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRevealNextHint}
          className="w-full gap-2 border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:text-purple-200"
        >
          <WandIcon className="size-3.5 text-purple-400" />
          Открыть следующую подсказку ({revealedHints + 1}/{task.hints.length})
        </Button>
      )}
    </div>
  );
}
