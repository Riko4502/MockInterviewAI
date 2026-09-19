"use client";

import { Typography } from "@packages/ui";
import { useSandboxStore } from "../model/useSandboxStore";

export function SandboxConsoleLogs() {
  const runResult = useSandboxStore((s) => s.runResult);

  if (!runResult?.logs || runResult.logs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <Typography.P className="text-xs">
          Нет записей в консоли. Используйте console.log() в коде.
        </Typography.P>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {runResult.logs.map((log, idx) => (
        <div
          key={`log-${idx}-${log.slice(0, 15)}`}
          className={`rounded px-2 py-1 leading-relaxed ${
            log.startsWith("[ERROR]")
              ? "bg-rose-500/10 text-rose-400"
              : log.startsWith("[WARN]")
                ? "bg-amber-500/10 text-amber-400"
                : "text-foreground/80 hover:bg-muted/30"
          }`}
        >
          <span className="mr-2 select-none text-muted-foreground opacity-50">
            {idx + 1}
          </span>
          {log}
        </div>
      ))}
    </div>
  );
}
