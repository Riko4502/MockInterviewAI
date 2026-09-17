"use client";

export function DynamicBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden -z-20"
    >
      {/* 1. Base Apple Canvas Layer */}
      <div className="absolute inset-0 bg-[#f5f5f7] dark:bg-[#000000] transition-colors" />

      {/* 2. Apple Spotlight Top Ambient Glow */}
      <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-radial from-violet-500/15 via-indigo-500/10 to-transparent dark:from-violet-600/20 dark:via-blue-600/10 dark:to-transparent blur-[140px] pointer-events-none rounded-full" />

      {/* 3. Subtle Cybernetic Dot Grid Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-60 dark:opacity-40 [mask-image:radial-gradient(ellipse_90%_70%_at_50%_35%,black_40%,transparent_100%)]" />

      {/* 4. Apple Intelligence Ambient Edge Blooms */}
      {/* Orb Left: Violet / Fuchsia */}
      <div className="absolute top-[25%] left-[-15%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-violet-400/20 via-fuchsia-300/15 to-transparent dark:from-violet-600/15 dark:via-fuchsia-600/10 blur-[140px] animate-orb-1" />

      {/* Orb Right: Electric Cyan / Blue */}
      <div className="absolute top-[40%] right-[-15%] w-[650px] h-[650px] rounded-full bg-gradient-to-bl from-sky-400/20 via-cyan-300/15 to-transparent dark:from-sky-500/15 dark:via-blue-600/10 blur-[150px] animate-orb-2" />

      {/* Orb Bottom: Subtle Emerald Tint */}
      <div className="absolute bottom-[-10%] left-[25%] w-[700px] h-[500px] rounded-full bg-gradient-to-tr from-emerald-400/15 via-teal-300/10 to-transparent dark:from-emerald-600/10 dark:via-teal-600/5 blur-[160px] animate-orb-3" />
    </div>
  );
}
