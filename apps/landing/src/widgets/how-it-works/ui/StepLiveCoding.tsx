"use client";

import { CheckIcon } from "@packages/icons";
import { Button } from "@packages/ui";
import { useState } from "react";
import { useLandingTranslations } from "@/shared/lib";
import { AiHintBanner } from "./AiHintBanner";
import { StepHeader } from "./StepHeader";

export function StepLiveCoding() {
  const { landing } = useLandingTranslations();
  const [isRunning, setIsRunning] = useState(false);
  const [completedSteps, setCompletedSteps] = useState(4);

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
          tag={landing.howItWorks.step3Tag}
          title={landing.howItWorks.step3Title}
          description={landing.howItWorks.step3Desc}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-xs">
          <div className="p-3.5 rounded-xl bg-sky-950/20 border border-sky-500/20 hover:border-sky-500/40 transition-colors">
            <div className="font-bold text-sky-200 text-sm">
              {landing.howItWorks.badgeLanguages}
            </div>
            <div className="text-slate-400 mt-1">
              {landing.howItWorks.badgeLanguagesDesc}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-sky-950/20 border border-sky-500/20 hover:border-sky-500/40 transition-colors">
            <div className="font-bold text-sky-200 text-sm">
              {landing.howItWorks.badgeTests}
            </div>
            <div className="text-slate-400 mt-1">
              {landing.howItWorks.badgeTestsDesc}
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-6">
        <div className="glass-panel rounded-2xl p-4 border border-sky-500/30 shadow-xl glow-card font-mono text-xs relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-36 h-36 bg-sky-600/10 blur-2xl pointer-events-none rounded-full" />

          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 text-slate-400 text-[11px] relative z-10">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold flex items-center gap-1.5">
                <span className="text-sky-400 font-bold">TS</span>
                lru_cache.ts
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">TypeScript 5.7</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={runTestSimulation}
              disabled={isRunning}
              className="rounded-lg bg-sky-500/15 border-sky-500/30 text-sky-300 hover:bg-sky-500/25 text-[11px] font-mono gap-1.5"
            >
              <span>{isRunning ? "Running..." : "Run Tests ▶"}</span>
            </Button>
          </div>

          <div className="space-y-1.5 text-slate-300 py-2 leading-relaxed bg-[#0a0c16]/90 p-3 rounded-xl border border-sky-500/20 font-mono relative z-10">
            <div>
              <span className="text-sky-400 font-semibold">class</span>{" "}
              <span className="text-amber-300">LRUCache</span>&lt;
              <span className="text-emerald-300">K, V</span>&gt; &#123;
            </div>
            <div className="pl-4">
              <span className="text-sky-400">private</span> capacity:{" "}
              <span className="text-amber-300">number</span>
              <span className="text-slate-400">;</span>
            </div>
            <div className="pl-4">
              <span className="text-sky-400">private</span> cache ={" "}
              <span className="text-sky-400">new</span>{" "}
              <span className="text-amber-300">Map</span>&lt;
              <span className="text-emerald-300">K, V</span>&gt;();
            </div>
            <div className="pl-4">
              <span className="text-sky-400">get</span>(key:{" "}
              <span className="text-emerald-300">K</span>):{" "}
              <span className="text-emerald-300">V</span> |{" "}
              <span className="text-sky-400">undefined</span> &#123;
            </div>
            <div className="pl-8 text-slate-400">
              <span className="text-sky-400">if</span> (!
              <span className="text-sky-400">this</span>.cache.has(key)){" "}
              <span className="text-sky-400">return undefined</span>
              <span>;</span>
            </div>
            <div className="pl-8 text-sky-300">
              const val = this.cache.get(key)!;
            </div>
            <div className="pl-8 text-emerald-400">
              this.cache.delete(key); this.cache.set(key, val);
            </div>
            <div className="pl-8 text-sky-400">return val;</div>
            <div className="pl-4">&#125;</div>
            <div>&#125;</div>
          </div>

          {/* Dynamic Test Execution Output Console */}
          <div className="mt-3 p-3 rounded-xl bg-[#060810]/95 border border-sky-500/20 space-y-1.5 text-[11px] font-mono relative z-10">
            <div className="flex items-center justify-between text-slate-400 text-[10px] pb-1 border-b border-white/5">
              <span className="text-sky-300">TEST SUITE CONSOLE</span>
              <span>{isRunning ? "EXEC..." : "18/18 PASSED"}</span>
            </div>
            {completedSteps >= 1 && (
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckIcon className="w-3 h-3" />
                <span>test_cache_initialization (2ms)</span>
              </div>
            )}
            {completedSteps >= 2 && (
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckIcon className="w-3 h-3" />
                <span>test_lru_eviction_policy (5ms)</span>
              </div>
            )}
            {completedSteps >= 3 && (
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckIcon className="w-3 h-3" />
                <span>test_concurrent_writes (9ms)</span>
              </div>
            )}
            {completedSteps >= 4 && (
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <CheckIcon className="w-3 h-3" />
                <span>test_memory_benchmark &lt; 2.4MB (12ms)</span>
              </div>
            )}
          </div>

          {/* AI Hint Notification Banner */}
          <AiHintBanner
            title={landing.howItWorks.step3HintTitle}
            badgeText={landing.howItWorks.step3HintBadge}
            hintText={landing.howItWorks.step3HintText}
          />

          <div className="mt-3 p-2.5 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between text-[11px] relative z-10">
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{landing.howItWorks.allTestsPassed}</span>
            </div>
            <div className="text-slate-300 font-mono">
              {landing.howItWorks.runtimeBeats}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
