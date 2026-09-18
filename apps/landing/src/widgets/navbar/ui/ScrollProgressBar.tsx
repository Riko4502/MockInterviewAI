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
    <div className="absolute bottom-0 left-4 right-4 h-[2px] pointer-events-none overflow-hidden rounded-full">
      {/* Dynamic Luminous Flow Bar */}
      <div
        className="h-full rounded-full transition-[width] duration-100 ease-out"
        style={{
          width: `${scrollProgress}%`,
          background:
            "linear-gradient(90deg, #ec4899 0%, #8b5cf6 35%, #3b82f6 70%, #06b6d4 100%)",
          boxShadow:
            "0 0 10px rgba(139, 92, 246, 0.7), 0 0 20px rgba(6, 182, 212, 0.4)",
        }}
      />
    </div>
  );
}
