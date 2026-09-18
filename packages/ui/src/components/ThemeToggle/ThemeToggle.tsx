"use client";

import { Button } from "@components/Button";
import { Tooltip } from "@components/Tooltip";
import { useTheme } from "@model/ThemeProvider";
import { MoonIcon, SunIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import type React from "react";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { ButtonSize, ButtonVariant } from "@/types";

export interface ThemeToggleProps {
  /** Текст тултипа для светлой темы */
  tooltipLight?: React.ReactNode;
  /** Текст тултипа для темной темы */
  tooltipDark?: React.ReactNode;
  /** Доступность: aria-label для кнопки */
  ariaLabel?: string;
  /** Дополнительные CSS классы */
  className?: string;
  /** Вариант кнопки */
  variant?: ButtonVariant;
  /** Размер кнопки */
  size?: ButtonSize;
}

export function ThemeToggle({
  tooltipLight = "Светлая тема",
  tooltipDark = "Темная тема",
  ariaLabel = "Переключить тему",
  className,
  variant = "outline",
  size = "icon",
}: ThemeToggleProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "w-8 h-8 rounded-full bg-white/5 border border-border/40 opacity-50",
          className,
        )}
      />
    );
  }

  const isDark = resolvedTheme === "dark";
  const tooltipContent = isDark ? tooltipLight : tooltipDark;

  const toggleTheme = (event: React.MouseEvent<HTMLButtonElement>) => {
    const isAppearanceTransition =
      typeof document !== "undefined" &&
      "startViewTransition" in document &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const nextTheme = isDark ? "light" : "dark";

    if (!isAppearanceTransition) {
      setTheme(nextTheme);
      return;
    }

    const x = event.clientX;
    const y = event.clientY;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const transitionType = isDark ? "dark-to-light" : "light-to-dark";
    document.documentElement.setAttribute(
      "data-theme-transition",
      transitionType,
    );

    const transition = document.startViewTransition(() => {
      flushSync(() => {
        document.documentElement.classList.toggle("dark", nextTheme === "dark");
        setTheme(nextTheme);
      });
    });

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ];

      document.documentElement.animate(
        {
          clipPath: isDark ? [...clipPath].reverse() : clipPath,
        },
        {
          duration: 550,
          easing: "ease-in-out",
          pseudoElement: isDark
            ? "::view-transition-old(root)"
            : "::view-transition-new(root)",
        },
      );
    });

    transition.finished.finally(() => {
      document.documentElement.removeAttribute("data-theme-transition");
    });
  };

  return (
    <Tooltip content={tooltipContent} withArrow>
      <Button
        variant={variant}
        size={size}
        onClick={toggleTheme}
        aria-label={ariaLabel}
        className={cn(
          "rounded-full w-8 h-8 p-0 bg-white/5 hover:bg-white/10 dark:bg-white/5 dark:hover:bg-white/10 border-border dark:border-white/10 text-foreground transition-all",
          className,
        )}
      >
        {isDark ? (
          <SunIcon className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
        ) : (
          <MoonIcon className="w-4 h-4 text-violet-600 hover:-rotate-12 transition-transform" />
        )}
      </Button>
    </Tooltip>
  );
}

export default ThemeToggle;
