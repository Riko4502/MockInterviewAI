"use client";

import { CheckIcon, MicIcon, ZapIcon } from "@packages/icons";
import { Badge, Tabs, WindowHeader } from "@packages/ui";
import dynamic from "next/dynamic";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const CodeEditor = dynamic(
  () => import("@packages/editor").then((mod) => mod.CodeEditorLazy),
  {
    ssr: false,
    loading: () => <div className="h-[230px] w-full" />,
  },
);

const EVALUATE_STREAM_CODE = `// High-Performance Stream Evaluator
export async function evaluateStream(
  stream: AsyncIterable<Token>,
  signal: AbortSignal
): Promise<MetricVector> {
  const metrics = new PerformanceTracker();
  
  for await (const token of stream) {
    if (signal.aborted) break;
    metrics.recordLatency(token.timestamp);
    yield evaluatePrompt(token);
  }
  
  return metrics.finalize(); // O(1) Memory
}`;

const TEST_STREAM_CODE = `describe("Stream Evaluation • Concurrency & Race", () => {
  it("should process 10,000 chunks under 15ms", async () => {
    const tracker = new PerformanceTracker();
    const result = await evaluateStream(mockStream, abortSignal);
    expect(result.p99Latency).toBeLessThan(15); // Passed in 4.2ms ✓
  });
});`;

export function HeroCodeMockup() {
  const { t } = useTranslation("landing");
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("solution");
  const [latency, setLatency] = useState(24);

  useEffect(() => {
    setMounted(true);
  }, []);

  const editorTheme = mounted && resolvedTheme === "light" ? "light" : "dark";

  // Dynamic latency ping
  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(20 + Math.floor(Math.random() * 8));
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Ambient Multi-spectral Spotlight Glow behind the Studio Frame */}
      <div className="absolute -inset-1 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-cyan-500/20 dark:from-pink-500/25 dark:via-purple-600/30 dark:to-cyan-400/25 rounded-[36px] blur-2xl opacity-75 group-hover:opacity-100 transition-opacity pointer-events-none -z-10" />

      {/* Titanium Hardware Studio Frame */}
      <div className="relative rounded-[30px] p-2.5 sm:p-3 apple-glass border border-black/10 dark:border-white/[0.14] shadow-2xl backdrop-blur-2xl transition-all duration-500">
        {/* Apple Segmented Tabs Root */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val)}
          size="sm"
          className="w-full"
        >
          {/* Hardware Header with macOS Control Dots and Tab Switcher */}
          <WindowHeader
            actions={
              <>
                <div className="w-5 h-5 sm:w-auto sm:h-auto sm:px-2.5 sm:py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] sm:text-[10px] font-mono font-medium whitespace-nowrap flex items-center justify-center sm:gap-1.5 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="hidden sm:inline">
                    {t("hero.mockStatusLive")}
                  </span>
                </div>
                <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                  {latency}ms
                </span>
              </>
            }
          >
            <Tabs.List className="h-6 sm:h-7 p-0.5 bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.06] rounded-lg ml-0.5 sm:ml-2">
              <Tabs.Trigger
                value="solution"
                className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-mono rounded-md h-5 sm:h-6 data-[state=active]:bg-white dark:data-[state=active]:bg-[#181924] data-[state=active]:text-foreground dark:data-[state=active]:text-white data-[state=active]:shadow-sm whitespace-nowrap flex items-center gap-1"
              >
                <span className="text-sky-600 dark:text-sky-400 font-bold text-[9px] sm:text-[10px]">
                  TS
                </span>
                <span>
                  solution<span className="hidden xs:inline">.ts</span>
                </span>
              </Tabs.Trigger>
              <Tabs.Trigger
                value="test"
                className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-mono rounded-md h-5 sm:h-6 data-[state=active]:bg-white dark:data-[state=active]:bg-[#181924] data-[state=active]:text-foreground dark:data-[state=active]:text-white data-[state=active]:shadow-sm whitespace-nowrap flex items-center gap-1"
              >
                <span className="text-amber-600 dark:text-amber-400 font-bold text-[9px] sm:text-[10px]">
                  SPEC
                </span>
                <span>
                  test<span className="hidden xs:inline">.spec.ts</span>
                </span>
              </Tabs.Trigger>
            </Tabs.List>
          </WindowHeader>

          {/* Studio Editor Screen */}
          <div className="p-3.5 bg-black/[0.015] dark:bg-[#07070b]/90 rounded-b-[22px] space-y-3">
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-muted-foreground px-1 pb-1 gap-2">
              <span className="font-mono text-[9px] sm:text-[10px] tracking-wide uppercase opacity-70 truncate">
                TypeScript • React 19 • Algorithms
              </span>
              <span className="font-medium text-violet-600 dark:text-violet-400 shrink-0">
                {t("hero.mockRole")}
              </span>
            </div>

            {/* Monaco Editor Container in Tabs.Content */}
            <Tabs.Content
              value="solution"
              className="h-[230px] w-full rounded-2xl overflow-hidden border border-black/[0.06] dark:border-white/[0.06] bg-white/40 dark:bg-[#0c0d14]/80 outline-none"
            >
              <CodeEditor
                value={EVALUATE_STREAM_CODE}
                language="typescript"
                theme={editorTheme}
                readOnly
                options={{
                  fontSize: 12.5,
                  lineNumbers: "on",
                  lineNumbersMinChars: 2,
                  padding: { top: 12, bottom: 12 },
                  scrollBeyondLastLine: false,
                  minimap: { enabled: false },
                  scrollbar: {
                    vertical: "hidden",
                    horizontal: "hidden",
                  },
                }}
              />
            </Tabs.Content>

            <Tabs.Content
              value="test"
              className="h-[230px] w-full rounded-2xl overflow-hidden border border-black/[0.06] dark:border-white/[0.06] bg-white/40 dark:bg-[#0c0d14]/80 outline-none"
            >
              <CodeEditor
                value={TEST_STREAM_CODE}
                language="typescript"
                theme={editorTheme}
                readOnly
                options={{
                  fontSize: 12.5,
                  lineNumbers: "on",
                  lineNumbersMinChars: 2,
                  padding: { top: 12, bottom: 12 },
                  scrollBeyondLastLine: false,
                  minimap: { enabled: false },
                  scrollbar: {
                    vertical: "hidden",
                    horizontal: "hidden",
                  },
                }}
              />
            </Tabs.Content>

            {/* Status Bar */}
            <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between px-1 sm:px-2 pt-1 text-[10px] sm:text-[11px] text-muted-foreground font-mono gap-1">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{t("hero.mockTestsPassed")}</span>
              </div>
              <span className="shrink-0">{t("hero.mockComplexity")}</span>
            </div>
          </div>
        </Tabs>
      </div>

      {/* Floating Widget 1: Apple Intelligence Voice Wave Pill (Top-Right Overlap) */}
      <div className="hidden xs:flex absolute -top-7 right-0 sm:-right-6 p-3.5 rounded-2xl apple-glass border border-white/40 dark:border-white/15 shadow-2xl backdrop-blur-2xl items-center gap-3 animate-float pointer-events-auto">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-500 p-0.5 flex items-center justify-center shadow-lg shadow-purple-500/30">
          <div className="w-full h-full bg-black/80 rounded-[10px] flex items-center justify-center text-white">
            <MicIcon className="w-4 h-4 text-white" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              DEVSYNC Voice AI
            </span>
            <span className="text-[10px] text-emerald-500 font-mono font-medium">
              ● 42ms
            </span>
          </div>
          {/* Multi-color Siri Equalizer */}
          <div className="flex items-center gap-0.5 h-3 mt-1">
            <span className="w-1 bg-pink-500 rounded-full animate-siri-1" />
            <span className="w-1 bg-purple-500 rounded-full animate-siri-2" />
            <span className="w-1 bg-indigo-500 rounded-full animate-siri-3" />
            <span className="w-1 bg-blue-500 rounded-full animate-siri-4" />
            <span className="w-1 bg-cyan-500 rounded-full animate-siri-5" />
            <span className="w-1 bg-teal-400 rounded-full animate-siri-6" />
          </div>
        </div>
      </div>

      {/* Floating Widget 2: Pro Scorecard Verdict Badge (Bottom-Left Overlap) */}
      <div
        className="hidden sm:flex absolute -bottom-6 -left-6 p-3.5 rounded-2xl apple-glass border border-white/40 dark:border-white/15 shadow-2xl backdrop-blur-2xl items-center gap-3 animate-float pointer-events-auto"
        style={{ animationDelay: "-3s" }}
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25">
          <ZapIcon className="w-4 h-4" />
        </div>
        <div className="text-left">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground tracking-wide">
              STRONG HIRE
            </span>
            <Badge
              variant="statusSuccess"
              className="text-[9px] px-1.5 py-0 rounded-full font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
            >
              L6 Staff
            </Badge>
          </div>
          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
            98.4th Percentile • 0 Allocations
          </div>
        </div>
      </div>
    </div>
  );
}
