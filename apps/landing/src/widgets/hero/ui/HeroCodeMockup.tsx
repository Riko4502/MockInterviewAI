"use client";

import { CodeEditorLazy } from "@packages/editor";
import { CheckIcon } from "@packages/icons";
import { Badge, Button, Card } from "@packages/ui";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MOCKUP_TABS, type MockupTab } from "../constants";

const EVALUATE_STREAM_CODE = `export async function evaluateStream(
  stream: AsyncIterable<Token>
) {
  const metrics = new PerformanceTracker();
  for await (const token of stream) {
    metrics.recordLatency(token.timestamp);
    yield evaluatePrompt(token);
  }
}`;

const TEST_STREAM_CODE = `describe("Stream Evaluation", () => {
  it("should process all chunks in < 50ms", async () => {
    expect(latency).toBeLessThan(50); // Passed ✓
  });
});`;

export function HeroCodeMockup() {
  const { t } = useTranslation("landing");
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<MockupTab>("solution");
  const [latency, setLatency] = useState(28);
  const [hintExpanded, setHintExpanded] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  const editorTheme = mounted && resolvedTheme === "light" ? "light" : "dark";

  // Dynamic real-time latency ping fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(24 + Math.floor(Math.random() * 9));
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="relative rounded-2xl glass-panel p-2 shadow-2xl glow-card border border-border dark:border-white/15 overflow-hidden transition-all duration-300 hover:border-violet-500/40 animate-float bg-card/90 dark:bg-transparent">
      {/* Mockup Window Header & Tabs */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border dark:border-white/10 bg-muted/60 dark:bg-[#07080d]/90 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500/90 shadow-sm shadow-rose-500/50" />
          <span className="w-3 h-3 rounded-full bg-amber-500/90 shadow-sm shadow-amber-500/50" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/90 shadow-sm shadow-emerald-500/50" />

          {/* Interactive Tabs */}
          <div className="ml-2 flex items-center gap-1">
            {MOCKUP_TABS.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all ${
                  activeTab === tab.id
                    ? "bg-card dark:bg-[#131524] text-foreground dark:text-slate-200 border border-border dark:border-white/15 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.badge && (
                  <span className="text-sky-500 dark:text-sky-400 font-bold mr-1">
                    {tab.badge}
                  </span>
                )}
                <span>{tab.filename}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="statusSuccess"
            className="gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {t("hero.mockStatusLive")}
          </Badge>
          <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">
            {latency}ms
          </span>
        </div>
      </div>

      {/* Mockup Editor Body */}
      <div className="p-4 bg-muted/20 dark:bg-[#0a0c16]/95 rounded-b-xl font-mono text-xs text-foreground dark:text-slate-300 space-y-3">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground pb-2 border-b border-border/60 dark:border-white/5">
          <span>TypeScript • React 19 • Algorithms</span>
          <span className="text-violet-600 dark:text-violet-400 font-semibold">
            {t("hero.mockRole")}
          </span>
        </div>

        {/* Tab 1: Solution */}
        {activeTab === "solution" && (
          <div className="h-[210px] w-full rounded-xl overflow-hidden border border-border/40 dark:border-white/5">
            <CodeEditorLazy
              value={EVALUATE_STREAM_CODE}
              language="typescript"
              theme={editorTheme}
              readOnly
              options={{
                fontSize: 13,
                lineNumbers: "on",
                lineNumbersMinChars: 2,
                padding: { top: 10, bottom: 10 },
                scrollBeyondLastLine: false,
                scrollbar: {
                  vertical: "hidden",
                  horizontal: "hidden",
                },
              }}
            />
          </div>
        )}

        {/* Tab 2: Test Suite */}
        {activeTab === "test" && (
          <div className="h-[210px] w-full rounded-xl overflow-hidden border border-border/40 dark:border-white/5">
            <CodeEditorLazy
              value={TEST_STREAM_CODE}
              language="typescript"
              theme={editorTheme}
              readOnly
              options={{
                fontSize: 13,
                lineNumbers: "on",
                lineNumbersMinChars: 2,
                padding: { top: 10, bottom: 10 },
                scrollBeyondLastLine: false,
                scrollbar: {
                  vertical: "hidden",
                  horizontal: "hidden",
                },
              }}
            />
          </div>
        )}

        {/* Dynamic AI Feedback Floating Banner */}
        <button
          type="button"
          className="w-full text-left mt-4 p-3.5 rounded-xl bg-violet-500/10 dark:bg-violet-950/70 border border-violet-500/30 dark:border-violet-500/40 flex items-start gap-3 shadow-md shadow-violet-500/10 dark:shadow-violet-950/50 backdrop-blur-md cursor-pointer hover:border-violet-400/60 transition-all"
          onClick={() => setHintExpanded(!hintExpanded)}
          aria-expanded={hintExpanded}
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-md shadow-violet-600/40 text-white font-bold text-xs">
            AI
          </div>
          <div className="text-[11px] leading-relaxed flex-1">
            <div className="font-semibold text-violet-700 dark:text-violet-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{t("hero.mockAiFeedbackTitle")}</span>
                <Badge
                  variant="statusInfo"
                  className="text-[9px] px-1.5 py-0.2 rounded bg-violet-500/20 dark:bg-violet-500/30 text-violet-700 dark:text-violet-200 font-mono"
                >
                  {t("hero.metric3Value")}
                </Badge>
              </div>
              <span className="text-[10px] text-violet-600 dark:text-violet-400 underline">
                {hintExpanded ? "Hide" : "Show"}
              </span>
            </div>
            {hintExpanded && (
              <div className="text-muted-foreground dark:text-slate-300 mt-1 transition-all">
                {t("hero.mockAiFeedbackText")}
              </div>
            )}
          </div>
        </button>

        {/* Test Output Badge */}
        <div className="pt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/60 dark:border-white/5">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckIcon className="w-3.5 h-3.5" />
            {t("hero.mockTestsPassed")}
          </div>
          <span className="text-muted-foreground font-mono font-medium">
            {t("hero.mockComplexity")}
          </span>
        </div>
      </div>
    </Card>
  );
}
