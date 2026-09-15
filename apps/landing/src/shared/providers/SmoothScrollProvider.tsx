"use client";

import "lenis/dist/lenis.css";
import { ReactLenis } from "lenis/react";
import type { ReactNode } from "react";

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.075,
        duration: 1.5,
        smoothWheel: true,
        wheelMultiplier: 1.1,
        touchMultiplier: 1.8,
        syncTouch: false,
      }}
    >
      {children}
    </ReactLenis>
  );
}
