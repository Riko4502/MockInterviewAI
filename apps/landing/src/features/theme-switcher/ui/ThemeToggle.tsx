"use client";

import { MoonIcon, SunIcon } from "@packages/icons";
import { Button, Tooltip } from "@packages/ui";
import { useTheme } from "next-themes";
import type React from "react";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { t } = useTranslation("landing");

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center opacity-50" />
    );
  }

  const isDark = resolvedTheme === "dark";
  const label = isDark ? t("nav.themeLight") : t("nav.themeDark");

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
    <Tooltip content={label} withArrow>
      <Button
        variant="outline"
        size="icon"
        onClick={toggleTheme}
        aria-label={t("nav.toggleTheme")}
        className="rounded-full w-8 h-8 p-0 bg-white/5 hover:bg-white/10 dark:bg-white/5 dark:hover:bg-white/10 border-border dark:border-white/10 text-foreground transition-all"
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
