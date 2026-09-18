"use client";

import { WandIcon } from "@packages/icons";
import { Button, Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { useSandboxStore } from "../model/useSandboxStore";

export function SandboxTaskHints() {
  const { t } = useTranslation("interview");
  const task = useSandboxStore((s) => s.getCurrentTask());
  const revealedHints = useSandboxStore((s) => s.revealedHints);
  const revealNextHint = useSandboxStore((s) => s.revealNextHint);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4 text-xs text-purple-300">
        <div className="flex items-center gap-2 font-semibold">
          <WandIcon className="size-4 text-purple-400" />
          {t("sandbox.hints.title")}
        </div>
        <Typography.Muted className="mt-1 text-purple-300/80">
          {t("sandbox.hints.description")}
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
                  {t("sandbox.hints.hintNumber", { number: idx + 1 })}
                </span>
                {isRevealed && (
                  <span className="text-[10px] text-purple-400 font-medium">
                    {t("sandbox.hints.revealed")}
                  </span>
                )}
              </div>
              <div className="mt-2 text-xs leading-relaxed">
                {isRevealed ? hint : t("sandbox.hints.locked")}
              </div>
            </div>
          );
        })}
      </div>

      {revealedHints < task.hints.length && (
        <Button
          variant="outline"
          size="sm"
          onClick={revealNextHint}
          className="w-full gap-2 border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:text-purple-200"
        >
          <WandIcon className="size-3.5 text-purple-400" />
          {t("sandbox.hints.revealNext", {
            current: revealedHints + 1,
            total: task.hints.length,
          })}
        </Button>
      )}
    </div>
  );
}
