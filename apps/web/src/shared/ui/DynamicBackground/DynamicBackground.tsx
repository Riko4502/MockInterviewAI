/**
 * Презентационный Server Component динамического фона для страниц аутентификации.
 * Полностью базируется на CSS-анимациях и поддерживает prefers-reduced-motion.
 */
export function DynamicBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden -z-10 select-none"
    >
      {/* 1. Deep Space Cosmic Base */}
      <div className="absolute inset-0 bg-[#06070d]" />

      {/* 2. Cyber Matrix / Subtle Grid & Dot Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff0c_1px,transparent_1px)] [background-size:20px_20px] opacity-40 [mask-image:radial-gradient(ellipse_80%_60%_at_50%_50%,black_40%,transparent_100%)]" />

      {/* 3. Multi-Layer Dynamic Glowing Aurora Orbs */}
      {/* Orb 1: Electric Violet Aurora (Top Left / Center) */}
      <div className="absolute top-[-15%] left-[20%] h-[650px] w-[650px] rounded-full bg-gradient-to-br from-violet-600/30 via-purple-600/20 to-transparent blur-[140px] motion-reduce:animate-none animate-blob-1" />

      {/* Orb 2: Neon Cyan / Sky Plasma (Top Right) */}
      <div className="absolute top-[10%] right-[-15%] h-[600px] w-[600px] rounded-full bg-gradient-to-bl from-cyan-500/25 via-indigo-600/20 to-transparent blur-[130px] motion-reduce:animate-none animate-blob-2" />

      {/* Orb 3: Deep Magenta / Rose Flame (Bottom Left) */}
      <div className="absolute bottom-[-15%] left-[-15%] h-[700px] w-[700px] rounded-full bg-gradient-to-tr from-fuchsia-600/25 via-pink-600/15 to-transparent blur-[150px] motion-reduce:animate-none animate-blob-3" />

      {/* Orb 4: Indigo Flare (Bottom Right) */}
      <div className="absolute bottom-[-10%] right-[15%] h-[550px] w-[550px] rounded-full bg-gradient-to-tl from-indigo-600/25 via-purple-700/15 to-transparent blur-[140px] motion-reduce:animate-none animate-blob-1" />

      {/* 4. Center Ambient Card Glow */}
      <div className="absolute top-[35%] left-[50%] -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-violet-600/20 via-indigo-500/20 to-purple-600/15 blur-[110px] motion-reduce:animate-none animate-pulse-glow" />
    </div>
  );
}
