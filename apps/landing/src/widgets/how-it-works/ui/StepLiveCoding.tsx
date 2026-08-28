"use client";

import { useLandingTranslations } from "@/shared/lib";
import { AiHintBanner } from "./AiHintBanner";
import { StepHeader } from "./StepHeader";

export function StepLiveCoding() {
  const { landing } = useLandingTranslations();

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
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-violet-500/30 transition-colors">
            <div className="font-bold text-white text-sm">
              {landing.howItWorks.badgeLanguages}
            </div>
            <div className="text-slate-400 mt-1">
              {landing.howItWorks.badgeLanguagesDesc}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-violet-500/30 transition-colors">
            <div className="font-bold text-white text-sm">
              {landing.howItWorks.badgeTests}
            </div>
            <div className="text-slate-400 mt-1">
              {landing.howItWorks.badgeTestsDesc}
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-6">
        <div className="glass-panel rounded-2xl p-4 border border-white/15 shadow-xl glow-card font-mono text-xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 text-slate-400 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold flex items-center gap-1.5">
                <span className="text-sky-400 font-bold">TS</span>
                lru_cache.ts
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">TypeScript 5.7</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold">
              ✓ {landing.howItWorks.buildPassing}
            </span>
          </div>

          <div className="space-y-1.5 text-slate-300 py-2 leading-relaxed bg-[#0a0c16] p-3 rounded-xl border border-white/5 font-mono">
            <div>
              <span className="text-violet-400 font-semibold">class</span>{" "}
              <span className="text-amber-300">LRUCache</span>&lt;
              <span className="text-emerald-300">K, V</span>&gt; &#123;
            </div>
            <div className="pl-4">
              <span className="text-violet-400">private</span> capacity:{" "}
              <span className="text-amber-300">number</span>
              <span className="text-slate-400">;</span>
            </div>
            <div className="pl-4">
              <span className="text-violet-400">private</span> cache ={" "}
              <span className="text-violet-400">new</span>{" "}
              <span className="text-amber-300">Map</span>&lt;
              <span className="text-emerald-300">K, V</span>&gt;();
            </div>
            <div className="pl-4">
              <span className="text-violet-400">get</span>(key:{" "}
              <span className="text-emerald-300">K</span>):{" "}
              <span className="text-emerald-300">V</span> |{" "}
              <span className="text-violet-400">undefined</span> &#123;
            </div>
            <div className="pl-8 text-slate-400">
              <span className="text-violet-400">if</span> (!
              <span className="text-violet-400">this</span>.cache.has(key)){" "}
              <span className="text-violet-400">return undefined</span>
              <span>;</span>
            </div>
            <div className="pl-8 text-sky-300">
              const val = this.cache.get(key)!;
            </div>
            <div className="pl-8 text-emerald-400">
              this.cache.delete(key); this.cache.set(key, val);
            </div>
            <div className="pl-8 text-violet-400">return val;</div>
            <div className="pl-4">&#125;</div>
            <div>&#125;</div>
          </div>

          {/* AI Hint Notification Banner */}
          <AiHintBanner
            title={landing.howItWorks.step3HintTitle}
            badgeText={landing.howItWorks.step3HintBadge}
            hintText={landing.howItWorks.step3HintText}
          />

          <div className="mt-3 p-2.5 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{landing.howItWorks.allTestsPassed}</span>
            </div>
            <div className="text-slate-300">
              {landing.howItWorks.runtimeBeats}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
