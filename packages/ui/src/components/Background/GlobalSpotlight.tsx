"use client";

import { cn } from "@packages/utils";
import { useEffect, useState } from "react";

export interface GlobalSpotlightProps {
  className?: string;
  size?: number;
  color?: string;
}

export function GlobalSpotlight({
  className,
  size = 900,
  color = "rgba(139, 92, 246, 0.07), rgba(99, 102, 241, 0.03)",
}: GlobalSpotlightProps) {
  const [mousePosition, setMousePosition] = useState({ x: -1000, y: -1000 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        setMousePosition({ x: e.clientX, y: e.clientY });
        setIsVisible(true);
      });
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.body.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      document.body.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-0 pointer-events-none z-30 transition-opacity duration-500 overflow-hidden",
        className,
      )}
      style={{
        opacity: isVisible ? 1 : 0,
        background: `radial-gradient(${size}px circle at ${mousePosition.x}px ${mousePosition.y}px, ${color}, transparent 70%)`,
      }}
    />
  );
}

export default GlobalSpotlight;
