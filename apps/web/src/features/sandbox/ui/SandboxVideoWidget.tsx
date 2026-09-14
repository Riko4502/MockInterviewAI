"use client";

import { useState } from "react";
import { useSandboxStore } from "../model/useSandboxStore";
import { SandboxVideoWidgetControls } from "./SandboxVideoWidgetControls";
import { SandboxVideoWidgetHeader } from "./SandboxVideoWidgetHeader";
import { SandboxVideoWidgetScreen } from "./SandboxVideoWidgetScreen";

export function SandboxVideoWidget() {
  const isVideoOpen = useSandboxStore((s) => s.isVideoOpen);
  const toggleVideoOpen = useSandboxStore((s) => s.toggleVideoOpen);
  const [isMinimized, setIsMinimized] = useState(false);

  if (!isVideoOpen) return null;

  return (
    <div
      className={`fixed right-6 bottom-6 z-50 overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur-xl transition-all duration-300 ${
        isMinimized ? "w-72" : "w-96"
      }`}
    >
      <SandboxVideoWidgetHeader
        isMinimized={isMinimized}
        onToggleMinimize={() => setIsMinimized((prev) => !prev)}
        onClose={toggleVideoOpen}
      />

      {!isMinimized && <SandboxVideoWidgetScreen />}

      <SandboxVideoWidgetControls />
    </div>
  );
}
