"use client";

import { useEffect, useState } from "react";

export function ScrollProgressBar() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        const currentProgress = (window.scrollY / totalScroll) * 100;
        setScrollProgress(Math.min(100, Math.max(0, currentProgress)));
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (scrollProgress <= 0.5) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-white/[0.04] pointer-events-none overflow-visible">
      {/* Dynamic Luminous Flow Bar */}
      <div
        className="h-full relative transition-[width] duration-100 ease-out"
        style={{
          width: `${scrollProgress}%`,
          background:
            "linear-gradient(90deg, #7c3aed 0%, #6366f1 40%, #38bdf8 80%, #a855f7 100%)",
          boxShadow:
            "0 0 12px rgba(139, 92, 246, 0.8), 0 0 24px rgba(56, 189, 248, 0.4)",
        }}
      >
        {/* Leading Glowing Spark / Comet Head */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2.5 h-2.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#38bdf8,0_0_20px_#a855f7] animate-pulse pointer-events-none" />

        {/* Laser Shine Ripple */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_2s_infinite]" />
      </div>
    </div>
  );
}
