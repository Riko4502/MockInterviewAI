"use client";

import { CodeEditorLazy } from "@packages/editor";
import { CheckIcon } from "@packages/icons";
import { Button } from "@packages/ui";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SIMULATION_TEST_STEPS } from "../constants";
import { AiHintBanner } from "./AiHintBanner";
import { StepHeader } from "./StepHeader";

const LRU_CACHE_CODE = `class LRUCache<K, V> {
  private capacity: number;
  private cache = new Map<K, V>();

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const val = this.cache.get(key)!;
    this.cache.delete(key); this.cache.set(key, val);
    return val;
  }
}`;

export function StepLiveCoding() {
  const { t } = useTranslation("landing");
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSteps, setCompletedSteps] = useState(4);

  useEffect(() => {
    setMounted(true);
  }, []);

  const editorTheme = mounted && resolvedTheme === "light" ? "light" : "dark";

  const runTestSimulation = () => {
    if (isRunning) return;
    setIsRunning(true);
    setCompletedSteps(0);

    setTimeout(() => setCompletedSteps(1), 300);
    setTimeout(() => setCompletedSteps(2), 650);
    setTimeout(() => setCompletedSteps(3), 950);
    setTimeout(() => {
      setCompletedSteps(4);
      setIsRunning(false);
    }, 1300);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
      <div className="lg:col-span-6 flex flex-col items-start">
        <StepHeader
          stepNumber="03"
          tag={t("howItWorks.step3Tag")}
          title={t("howItWorks.step3Title")}
          description={t("howItWorks.step3Desc")}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-xs">
          <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 hover:border-sky-500/40 transition-colors">
            <div className="font-bold text-sky-700 dark:text-sky-200 text-sm">
              {t("howItWorks.badgeLanguages")}
            </div>
            <div className="text-muted-foreground mt-1">
              {t("howItWorks.badgeLanguagesDesc")}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 hover:border-sky-500/40 transition-colors">
            <div className="font-bold text-sky-700 dark:text-sky-200 text-sm">
              {t("howItWorks.badgeTests")}
            </div>
            <div className="text-muted-foreground mt-1">
              {t("howItWorks.badgeTestsDesc")}
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-6">
        <div className="glass-panel rounded-2xl p-4 border border-sky-500/30 shadow-xl glow-card font-mono text-xs relative overflow-hidden bg-card/80 dark:bg-[#07080e]/90">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-36 h-36 bg-sky-600/10 blur-2xl pointer-events-none rounded-full" />

          <div className="flex items-center justify-between pb-3 mb-3 border-b border-border dark:border-white/10 text-muted-foreground text-[11px] relative z-10">
            <div className="flex items-center gap-2">
              <span className="text-foreground font-semibold flex items-center gap-1.5">
                <span className="text-sky-500 dark:text-sky-400 font-bold">
                  TS
                </span>
                lru_cache.ts
              </span>
              <span className="text-muted-foreground/60">•</span>
              <span className="text-muted-foreground">TypeScript 5.7</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={runTestSimulation}
              disabled={isRunning}
              className="rounded-lg bg-sky-500/15 border-sky-500/30 text-sky-700 dark:text-sky-300 hover:bg-sky-500/25 text-[11px] font-mono gap-1.5"
            >
              <span>{isRunning ? "Running..." : "Run Tests ▶"}</span>
            </Button>
          </div>

          <div className="h-[210px] w-full rounded-xl overflow-hidden border border-sky-500/20 bg-white dark:bg-[#0a0c16]/95 relative z-10">
            <CodeEditorLazy
              value={LRU_CACHE_CODE}
              language="typescript"
              theme={editorTheme}
              readOnly
              options={{
                fontSize: 13,
                lineNumbers: "off",
                lineNumbersMinChars: 0,
                glyphMargin: false,
                folding: false,
                lineDecorationsWidth: 10,
                padding: { top: 12, bottom: 12 },
                scrollBeyondLastLine: false,
                scrollbar: {
                  vertical: "hidden",
                  horizontal: "hidden",
                },
              }}
            />
          </div>

          {/* Dynamic Test Execution Output Console */}
          <div className="mt-3 p-3 rounded-xl bg-slate-100/90 dark:bg-[#060810]/95 border border-slate-200/80 dark:border-sky-500/20 space-y-1.5 text-[11px] font-mono relative z-10">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] pb-1 border-b border-slate-200 dark:border-white/5">
              <span className="text-sky-600 dark:text-sky-300 font-semibold">
                TEST SUITE CONSOLE
              </span>
              <span className="font-medium text-slate-600 dark:text-slate-400">
                {isRunning ? "EXEC..." : "18/18 PASSED"}
              </span>
            </div>
            {SIMULATION_TEST_STEPS.map(
              (item) =>
                completedSteps >= item.step && (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 text-emerald-600 dark:text-emerald-400 ${
                      item.isHighlighted ? "font-semibold" : ""
                    }`}
                  >
                    <CheckIcon className="w-3 h-3" />
                    <span>{item.label}</span>
                  </div>
                ),
            )}
          </div>

          {/* AI Hint Notification Banner */}
          <AiHintBanner
            title={t("howItWorks.step3HintTitle")}
            badgeText={t("howItWorks.step3HintBadge")}
            hintText={t("howItWorks.step3HintText")}
          />

          <div className="mt-3 p-2.5 rounded-xl bg-accent/40 dark:bg-slate-900/90 border border-border dark:border-white/10 flex items-center justify-between text-[11px] relative z-10">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{t("howItWorks.allTestsPassed")}</span>
            </div>
            <div className="text-muted-foreground font-mono">
              {t("howItWorks.runtimeBeats")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
