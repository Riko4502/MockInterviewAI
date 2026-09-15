"use client";

import { Avatar, Toast } from "@packages/ui";
import { useEffect, useState } from "react";
import { ACTIVITIES } from "../constants";

export function LiveActivityToast() {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setOpen(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % ACTIVITIES.length);
        setOpen(true);
      }, 400);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const current = ACTIVITIES[index];

  return (
    <Toast.Provider swipeDirection="down" duration={Infinity}>
      <Toast
        key={index}
        open={open}
        onOpenChange={setOpen}
        showCloseButton={false}
        className="glass-panel border-border/80 dark:border-white/10 shadow-xl backdrop-blur-xl bg-card/90 dark:bg-[#0c0e17]/85 !w-auto inline-flex items-center p-2.5 sm:px-3.5 sm:py-2.5 rounded-2xl pointer-events-auto space-x-0 transition-all duration-300 data-[state=closed]:!slide-out-to-right-0 data-[state=closed]:!slide-out-to-bottom-2 data-[state=open]:!slide-in-from-bottom-2 data-[state=closed]:!opacity-0 data-[state=open]:!opacity-100"
      >
        <div className="flex items-center gap-3">
          <Avatar size="sm" className="size-8 shrink-0">
            <Avatar.Fallback className="bg-gradient-to-tr from-violet-600 to-indigo-600 text-white text-xs font-bold shadow-md shadow-violet-600/30">
              {current.user.slice(0, 1)}
            </Avatar.Fallback>
          </Avatar>
          <div className="flex flex-col gap-0.5 min-w-0 pr-1">
            <Toast.Title className="text-xs font-medium text-foreground flex items-center gap-1.5 leading-tight">
              <span>{current.user}</span>
              <span className="text-[10px] text-muted-foreground font-normal">
                • {current.time}
              </span>
            </Toast.Title>
            <Toast.Description className="text-[11px] text-muted-foreground leading-tight mt-0.5 whitespace-nowrap">
              {current.role} ➔{" "}
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                {current.verdict} ({current.score})
              </span>
            </Toast.Description>
          </div>
        </div>
      </Toast>

      <Toast.Viewport className="fixed bottom-6 left-6 z-40 w-auto p-0 m-0 hidden sm:flex flex-col items-start pointer-events-none focus-visible:outline-none" />
    </Toast.Provider>
  );
}
