"use client";

import { CodeEditorLazy } from "@packages/editor";
import {
  CheckIcon,
  CodeIcon,
  DotIcon,
  PlayIcon,
  SpinnerIcon,
  TypescriptIcon,
  ZapIcon,
} from "@packages/icons";
import { Button, Card, WindowHeader } from "@packages/ui";
import { cn } from "@packages/utils";
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
      {/* Left Column: Clear Educational Explanation & 3 Takeaways */}
      <div className="lg:col-span-6 flex flex-col items-start">
        <StepHeader
          stepNumber="03"
          tag={t("howItWorks.step3Tag")}
          title={t("howItWorks.step3Title")}
          description={t("howItWorks.step3Desc")}
        />

        {/* 3 Clear Feature Takeaways matching Step 4 design */}
        <div className="space-y-3.5 w-full mt-2">
          <Card className="p-4 rounded-2xl bg-black/[0.03] dark:bg-[#07070c]/90 border border-black/[0.06] dark:border-white/[0.08] flex flex-row items-start gap-3.5 backdrop-blur-xl shadow-none ring-0">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0 mt-0.5">
              <CodeIcon className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-foreground">
                {t("howItWorks.step3Benefit1Title")}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {t("howItWorks.step3Benefit1Desc")}
              </div>
            </div>
          </Card>

          <Card className="p-4 rounded-2xl bg-black/[0.03] dark:bg-[#07070c]/90 border border-black/[0.06] dark:border-white/[0.08] flex flex-row items-start gap-3.5 backdrop-blur-xl shadow-none ring-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
              <CheckIcon className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-foreground">
                {t("howItWorks.step3Benefit2Title")}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {t("howItWorks.step3Benefit2Desc")}
              </div>
            </div>
          </Card>

          <Card className="p-4 rounded-2xl bg-black/[0.03] dark:bg-[#07070c]/90 border border-black/[0.06] dark:border-white/[0.08] flex flex-row items-start gap-3.5 backdrop-blur-xl shadow-none ring-0">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
              <ZapIcon className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-foreground">
                {t("howItWorks.step3Benefit3Title")}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {t("howItWorks.step3Benefit3Desc")}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Right Column: Apple Studio Collaborative IDE Card */}
      <div className="lg:col-span-6">
        <Card className="apple-glass rounded-[28px] p-5 sm:p-6 border border-black/[0.08] dark:border-white/[0.08] shadow-2xl relative overflow-hidden backdrop-blur-2xl ring-0">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-sky-600/10 dark:bg-sky-600/15 blur-3xl pointer-events-none rounded-full" />

          {/* Top Window Bar: Traffic Light Dots + Active File Tab + Run Tests Button */}
          <WindowHeader
            className="pb-3 mb-3"
            actions={
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={runTestSimulation}
                disabled={isRunning}
                className="rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/30 text-sky-700 dark:text-sky-300 text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1 transition-all shadow-sm active:scale-95 flex items-center gap-1.5 shrink-0"
              >
                {isRunning ? (
                  <>
                    <SpinnerIcon className="w-3.5 h-3.5 animate-spin text-sky-500" />
                    <span>{t("howItWorks.runningTests")}</span>
                  </>
                ) : (
                  <>
                    <PlayIcon className="w-3.5 h-3.5 fill-current" />
                    <span>{t("howItWorks.runTests")}</span>
                  </>
                )}
              </Button>
            }
          >
            {/* Active Tab */}
            <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-[10px] sm:text-[11px] font-mono min-w-0">
              <TypescriptIcon className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              <span className="font-semibold text-foreground truncate">
                lru_cache.ts
              </span>
              <span className="hidden xs:inline text-muted-foreground/60 text-[10px] shrink-0">
                • TS 5.7
              </span>
            </div>
          </WindowHeader>

          {/* Monaco Editor Container */}
          <div className="h-[210px] w-full rounded-2xl overflow-hidden border border-black/[0.06] dark:border-white/[0.08] bg-background dark:bg-[#06070d]/95 relative z-10 shadow-inner">
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

          {/* Test Suite Console Output Drawer */}
          <Card className="mt-3.5 p-3 rounded-2xl bg-black/[0.03] dark:bg-[#07070c]/90 border border-black/[0.06] dark:border-white/[0.08] space-y-2 text-[11px] font-mono relative z-10 backdrop-blur-xl shadow-none ring-0 min-h-[114px]">
            <div className="flex items-center justify-between text-[10px] pb-1.5 border-b border-black/[0.04] dark:border-white/[0.06]">
              <span className="text-sky-600 dark:text-sky-400 font-bold uppercase tracking-wider">
                {t("howItWorks.testSuiteConsole")}
              </span>
              <span className="font-semibold text-muted-foreground">
                {isRunning
                  ? t("howItWorks.executing")
                  : t("howItWorks.passedCount")}
              </span>
            </div>
            <div className="space-y-1 min-h-[76px]">
              {SIMULATION_TEST_STEPS.map((item) => {
                const isPassed = completedSteps >= item.step;
                const isCurrent = isRunning && completedSteps === item.step - 1;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-2 text-[11px] font-mono leading-tight transition-colors duration-200",
                      isPassed
                        ? "text-emerald-600 dark:text-emerald-400"
                        : isCurrent
                          ? "text-sky-600 dark:text-sky-400"
                          : "text-muted-foreground/40",
                      item.isHighlighted && isPassed && "font-semibold",
                    )}
                  >
                    {isPassed ? (
                      <CheckIcon className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                    ) : isCurrent ? (
                      <SpinnerIcon className="w-3.5 h-3.5 shrink-0 animate-spin text-sky-500" />
                    ) : (
                      <DotIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground/30" />
                    )}
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* AI Hint Notification Banner */}
          <AiHintBanner
            title={t("howItWorks.step3HintTitle")}
            badgeText={t("howItWorks.step3HintBadge")}
            hintText={t("howItWorks.step3HintText")}
          />

          {/* Bottom Execution Status Strip */}
          <Card className="mt-3.5 p-2.5 sm:p-3 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/20 dark:border-emerald-500/30 flex flex-col xs:flex-row items-start xs:items-center justify-between gap-1 sm:gap-2 text-xs relative z-10 shadow-none ring-0">
            <div className="flex items-center gap-1.5 sm:gap-2 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] sm:text-xs shrink-0">
              <DotIcon className="w-4 h-4 text-emerald-500 animate-pulse shrink-0" />
              <span>{t("howItWorks.allTestsPassed")}</span>
            </div>
            <div className="text-muted-foreground font-mono text-[10px] sm:text-[11px] pl-5 xs:pl-0">
              {t("howItWorks.runtimeBeats")}
            </div>
          </Card>
        </Card>
      </div>
    </div>
  );
}
