"use client";

import { MoonIcon, SunIcon } from "@packages/icons";
import { Button, Tooltip } from "@packages/ui";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function ThemeToggle() {
  const { theme: _theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { t: _t } = useTranslation("landing");

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center opacity-50" />
    );
  }

  const isDark = resolvedTheme === "dark";
  const label = isDark
    ? "Светлая тема / Light mode"
    : "Тёмная тема / Dark mode";

  return (
    <Tooltip content={label} withArrow>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label="Toggle theme"
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
