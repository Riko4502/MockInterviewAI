"use client";

import { CheckIcon } from "@packages/icons";
import { Badge, Button, Card } from "@packages/ui";
import { useEffect, useState } from "react";
import { useLandingTranslations } from "@/shared/lib";

type MockupTab = "solution" | "test";

export function HeroCodeMockup() {
  const { landing } = useLandingTranslations();
  const [activeTab, setActiveTab] = useState<MockupTab>("solution");
  const [latency, setLatency] = useState(28);
  const [hintExpanded, setHintExpanded] = useState(true);

  // Dynamic real-time latency ping fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(24 + Math.floor(Math.random() * 9));
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="relative rounded-2xl glass-panel p-2 shadow-2xl glow-card border border-white/15 overflow-hidden transition-all duration-300 hover:border-violet-500/40 animate-float">
      {/* Mockup Window Header & Tabs */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 bg-[#07080d]/90 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500/90 shadow-sm shadow-rose-500/50" />
          <span className="w-3 h-3 rounded-full bg-amber-500/90 shadow-sm shadow-amber-500/50" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/90 shadow-sm shadow-emerald-500/50" />

          {/* Interactive Tabs */}
          <div className="ml-2 flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setActiveTab("solution")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all ${
                activeTab === "solution"
                  ? "bg-[#131524] text-slate-200 border border-white/15 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span className="text-sky-400 font-bold mr-1">TS</span>
              <span>solution.ts</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setActiveTab("test")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all ${
                activeTab === "test"
                  ? "bg-[#131524] text-slate-200 border border-white/15 shadow-sm"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <span>test.spec.ts</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="statusSuccess"
            className="gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {landing.hero.mockStatusLive}
          </Badge>
          <span className="text-[10px] font-mono text-slate-400 w-10 text-right">
            {latency}ms
          </span>
        </div>
      </div>

      {/* Mockup Editor Body */}
      <div className="p-4 bg-[#0a0c16]/95 rounded-b-xl font-mono text-xs text-slate-300 space-y-3">
        <div className="flex items-center justify-between text-[11px] text-slate-400 pb-2 border-b border-white/5">
          <span>TypeScript • React 19 • Algorithms</span>
          <span className="text-violet-400 font-semibold">
            {landing.hero.mockRole}
          </span>
        </div>

        {/* Tab 1: Solution */}
        {activeTab === "solution" && (
          <div className="space-y-1.5 text-slate-300 leading-relaxed font-mono">
            <div className="flex gap-3">
              <span className="text-slate-600 select-none text-right w-4">
                1
              </span>
              <div>
                <span className="text-violet-400 font-semibold">
                  export async function
                </span>{" "}
                <span className="text-sky-300">evaluateStream</span>(
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-slate-600 select-none text-right w-4">
                2
              </span>
              <div className="pl-4">
                <span className="text-slate-400">stream</span>:{" "}
                <span className="text-amber-300">AsyncIterable</span>&lt;
                <span className="text-emerald-300">Token</span>&gt;
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-slate-600 select-none text-right w-4">
                3
              </span>
              <div>) &#123;</div>
            </div>
            <div className="flex gap-3">
              <span className="text-slate-600 select-none text-right w-4">
                4
              </span>
              <div className="pl-4">
                <span className="text-violet-400">const</span> metrics ={" "}
                <span className="text-violet-400">new</span>{" "}
                <span className="text-amber-300">PerformanceTracker</span>();
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-slate-600 select-none text-right w-4">
                5
              </span>
              <div className="pl-4">
                <span className="text-violet-400">for await</span> (
                <span className="text-violet-400">const</span> token{" "}
                <span className="text-violet-400">of</span> stream) &#123;
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-slate-600 select-none text-right w-4">
                6
              </span>
              <div className="pl-8 text-sky-300">
                metrics.recordLatency(token.timestamp);
              </div>
            </div>
            <div className="flex gap-3 bg-violet-500/10 -mx-2 px-2 rounded">
              <span className="text-violet-400 select-none text-right w-4">
                7
              </span>
              <div className="pl-8 text-emerald-400">
                yield evaluatePrompt(token);{" "}
                <span className="inline-block w-1.5 h-3.5 bg-violet-400 animate-pulse ml-0.5" />
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-slate-600 select-none text-right w-4">
                8
              </span>
              <div className="pl-4">&#125;</div>
            </div>
            <div className="flex gap-3">
              <span className="text-slate-600 select-none text-right w-4">
                9
              </span>
              <div>&#125;</div>
            </div>
          </div>
        )}

        {/* Tab 2: Test Suite */}
        {activeTab === "test" && (
          <div className="space-y-1.5 text-slate-300 leading-relaxed font-mono">
            <div className="flex gap-3">
              <span className="text-slate-600 select-none text-right w-4">
                1
              </span>
              <div>
                <span className="text-violet-400 font-semibold">describe</span>
                (&quot;Stream Evaluation&quot;, () =&gt; &#123;
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-slate-600 select-none text-right w-4">
                2
              </span>
              <div className="pl-4">
                <span className="text-violet-400 font-semibold">it</span>
                (&quot;should process all chunks in &lt; 50ms&quot;,{" "}
                <span className="text-violet-400 font-semibold">async</span> ()
                =&gt; &#123;
              </div>
            </div>
            <div className="flex gap-3 bg-emerald-500/10 -mx-2 px-2 rounded">
              <span className="text-emerald-400 select-none text-right w-4">
                3
              </span>
              <div className="pl-8 text-emerald-300">
                expect(latency).toBeLessThan(50);{" "}
                <span className="text-emerald-400 font-semibold">
                  &#47;&#47; Passed ✓
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-slate-600 select-none text-right w-4">
                4
              </span>
              <div className="pl-4">&#125;);</div>
            </div>
            <div className="flex gap-3">
              <span className="text-slate-600 select-none text-right w-4">
                5
              </span>
              <div>&#125;);</div>
            </div>
          </div>
        )}

        {/* Dynamic AI Feedback Floating Banner */}
        <button
          type="button"
          className="w-full text-left mt-4 p-3.5 rounded-xl bg-violet-950/70 border border-violet-500/40 flex items-start gap-3 shadow-lg shadow-violet-950/50 backdrop-blur-md cursor-pointer hover:border-violet-400/60 transition-all"
          onClick={() => setHintExpanded(!hintExpanded)}
          aria-expanded={hintExpanded}
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-md shadow-violet-600/40 text-white font-bold text-xs">
            AI
          </div>
          <div className="text-[11px] leading-relaxed flex-1">
            <div className="font-semibold text-violet-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{landing.hero.mockAiFeedbackTitle}</span>
                <Badge
                  variant="statusInfo"
                  className="text-[9px] px-1.5 py-0.2 rounded bg-violet-500/30 text-violet-200 font-mono"
                >
                  {landing.hero.metric3Value}
                </Badge>
              </div>
              <span className="text-[10px] text-violet-400 underline">
                {hintExpanded ? "Hide" : "Show"}
              </span>
            </div>
            {hintExpanded && (
              <div className="text-slate-300 mt-1 transition-all">
                {landing.hero.mockAiFeedbackText}
              </div>
            )}
          </div>
        </button>

        {/* Test Output Badge */}
        <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-white/5">
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <CheckIcon className="w-3.5 h-3.5" />
            {landing.hero.mockTestsPassed}
          </div>
          <span className="text-slate-400 font-mono font-medium">
            {landing.hero.mockComplexity}
          </span>
        </div>
      </div>
    </Card>
  );
}
