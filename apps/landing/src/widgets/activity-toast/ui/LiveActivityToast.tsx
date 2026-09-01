"use client";

import { useEffect, useState } from "react";

interface ActivityItem {
  id: number;
  user: string;
  role: string;
  verdict: string;
  score: string;
  time: string;
}

const ACTIVITIES: readonly ActivityItem[] = [
  {
    id: 1,
    user: "Alex K.",
    role: "Senior React Engineer",
    verdict: "Strong Hire",
    score: "96/100",
    time: "just now",
  },
  {
    id: 2,
    user: "Dmitry V.",
    role: "Go Realtime Architect",
    verdict: "Strong Hire",
    score: "94/100",
    time: "2m ago",
  },
  {
    id: 3,
    user: "Elena S.",
    role: "System Design Lead",
    verdict: "Hire",
    score: "89/100",
    time: "4m ago",
  },
];

export function LiveActivityToast() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % ACTIVITIES.length);
        setVisible(true);
      }, 500);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const current = ACTIVITIES[index];

  return (
    <div className="fixed bottom-6 left-6 z-40 max-w-xs sm:max-w-sm pointer-events-none hidden sm:block">
      <div
        className={`glass-panel p-3 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl transition-all duration-500 transform ${
          visible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-4 scale-95"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md shadow-violet-600/30">
            {current.user.slice(0, 1)}
          </div>
          <div className="text-xs leading-tight">
            <div className="text-white font-medium flex items-center gap-1.5">
              <span>{current.user}</span>
              <span className="text-[10px] text-slate-400">
                • {current.time}
              </span>
            </div>
            <div className="text-slate-400 text-[11px] mt-0.5">
              {current.role} ➔{" "}
              <span className="text-emerald-400 font-semibold">
                {current.verdict} ({current.score})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
