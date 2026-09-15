"use client";

export function DynamicBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden -z-20"
    >
      {/* 1. Base Layer */}
      <div className="absolute inset-0 bg-[#f8fafc] dark:bg-background transition-colors" />

      {/* 2. Cybernetic Grid & Dot Matrix Pattern with Radial Vignette */}
      <div className="absolute inset-0 bg-grid-pattern opacity-70 dark:opacity-60 [mask-image:radial-gradient(ellipse_80%_60%_at_50%_40%,black_40%,transparent_100%)]" />

      {/* 3. Floating Interactive Neon Gradient Orbs (Smooth Keyframe Physics) */}
      {/* Orb 1: Violet Nebula (Top Center) */}
      <div className="absolute top-[-10%] left-[20%] w-[650px] h-[650px] rounded-full bg-gradient-to-br from-violet-400/30 via-purple-300/25 to-transparent dark:from-violet-600/25 dark:via-purple-600/20 blur-[130px] animate-orb-1" />

      {/* Orb 2: Electric Cyan/Sky (Top Right) */}
      <div className="absolute top-[15%] right-[-10%] w-[550px] h-[550px] rounded-full bg-gradient-to-bl from-sky-400/30 via-indigo-300/20 to-transparent dark:from-sky-500/20 dark:via-indigo-600/15 blur-[120px] animate-orb-2" />

      {/* Orb 3: Cyber Magenta/Rose (Middle Left) */}
      <div className="absolute top-[45%] left-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-fuchsia-400/25 via-pink-300/20 to-transparent dark:from-fuchsia-600/15 dark:via-rose-600/15 blur-[130px] animate-orb-3" />

      {/* Orb 4: Emerald / Mint Glow (Bottom Right) */}
      <div className="absolute bottom-[10%] right-[10%] w-[700px] h-[700px] rounded-full bg-gradient-to-tl from-emerald-400/25 via-teal-300/20 to-transparent dark:from-emerald-600/15 dark:via-teal-600/15 blur-[140px] animate-orb-1" />

      {/* Orb 5: Deep Indigo Center Aura */}
      <div className="absolute top-[70%] left-[30%] w-[500px] h-[500px] rounded-full bg-gradient-to-r from-indigo-400/25 via-violet-300/20 to-transparent dark:from-indigo-600/15 dark:via-violet-600/15 blur-[120px] animate-orb-2" />

      {/* 4. Subtle Film Noise Texture Overlay for Rich Depth */}
      <div className="absolute inset-0 bg-[radial-gradient(#6366f10d_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] opacity-60 dark:opacity-40" />
    </div>
  );
}
