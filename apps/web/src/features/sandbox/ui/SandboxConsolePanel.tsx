"use client";

import { Tabs, Typography } from "@packages/ui";
import type { RunResult } from "../model/types";
import { SandboxConsoleLogs } from "./SandboxConsoleLogs";
import { SandboxConsoleTests } from "./SandboxConsoleTests";

interface SandboxConsolePanelProps {
  activeTab: "tests" | "logs";
  onTabChange: (tab: "tests" | "logs") => void;
  runResult: RunResult | null;
  isRunning: boolean;
  onRunCode: () => void;
}

export function SandboxConsolePanel({
  activeTab,
  onTabChange,
  runResult,
  isRunning,
  onRunCode,
}: SandboxConsolePanelProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-card/40">
      <Tabs
        value={activeTab}
        onValueChange={(val) => onTabChange(val as "tests" | "logs")}
        className="flex h-full flex-col overflow-hidden"
      >
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-card/70 px-3">
          <Tabs.List size="sm" className="bg-muted/60 p-0.5">
            <Tabs.Trigger value="tests" className="gap-1.5 text-xs">
              Результаты тестов
              {runResult && (
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    runResult.success
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-rose-500/20 text-rose-400"
                  }`}
                >
                  {runResult.passedTests}/{runResult.totalTests}
                </span>
              )}
            </Tabs.Trigger>

            <Tabs.Trigger value="logs" className="gap-1.5 text-xs">
              Консоль (Logs)
              {runResult?.logs && runResult.logs.length > 0 && (
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">
                  {runResult.logs.length}
                </span>
              )}
            </Tabs.Trigger>
          </Tabs.List>

          {runResult && (
            <Typography.Code className="text-[11px] text-muted-foreground font-mono">
              Время: {runResult.totalTimeMs} ms
            </Typography.Code>
          )}
        </div>

        <Tabs.Content
          value="tests"
          className="flex-1 overflow-y-auto p-4 text-xs font-mono"
        >
          <SandboxConsoleTests
            runResult={runResult}
            isRunning={isRunning}
            onRunCode={onRunCode}
          />
        </Tabs.Content>

        <Tabs.Content
          value="logs"
          className="flex-1 overflow-y-auto p-4 text-xs font-mono"
        >
          <SandboxConsoleLogs runResult={runResult} />
        </Tabs.Content>
      </Tabs>
    </div>
  );
}
