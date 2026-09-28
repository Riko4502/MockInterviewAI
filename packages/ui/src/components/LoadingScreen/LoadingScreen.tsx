"use client";

import { DynamicBackground } from "@components/Background/DynamicBackground";
import { Logo } from "@components/Logo";
import { cn } from "@packages/utils";
import * as React from "react";
import type { LoadingScreenProps } from "./types";

const DEFAULT_STEPS = [
  "Проверка окружения",
  "Синхронизация сессии",
  "Подготовка компонентов",
];

export function LoadingScreen({
  title = "MockInterview AI",
  description = "Подготовка рабочего пространства...",
  steps = DEFAULT_STEPS,
  badgeText = "ПОДГОТОВКА СИСТЕМЫ",
  showBackground = true,
  showLogo = true,
  showProgress = true,
  variant = "fullscreen",
  className,
  systemActiveText = "AI ENGINE ACTIVE",
  brandLabel = "MOCK INTERVIEW AI",
  "data-testid": testId = "loading-screen",
}: LoadingScreenProps) {
  const [progress, setProgress] = React.useState(18);
  const [activeStepIndex, setActiveStepIndex] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 96) return prev;
        const delta = Math.floor(Math.random() * 10) + 12;
        const next = Math.min(prev + delta, 96);
        return next;
      });
    }, 160);

    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (steps.length > 0) {
      const stepInterval = 100 / steps.length;
      const current = Math.min(
        Math.floor(progress / stepInterval),
        steps.length - 1,
      );
      setActiveStepIndex(current);
    }
  }, [progress, steps.length]);

  const activeStepText = steps[activeStepIndex] ?? description;

  const content = (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid={testId}
      className={cn(
        "relative z-10 w-full max-w-sm mx-auto p-6 sm:p-8 rounded-2xl",
        "bg-card/75 dark:bg-card/60 backdrop-blur-xl border border-border/50",
        "shadow-2xl shadow-violet-500/10 dark:shadow-violet-950/30",
        "flex flex-col items-center text-center transition-all duration-300",
      )}
    >
      {/* Мягкое свечение позади карточки */}
      <div
        aria-hidden="true"
        className="absolute -inset-0.5 -z-10 rounded-2xl bg-gradient-to-r from-violet-600/20 via-indigo-600/20 to-cyan-500/20 blur-xl opacity-75"
      />

      {/* Анимированный логотип с пульсирующим ореолом */}
      {showLogo && (
        <div className="relative flex items-center justify-center mb-5">
          <div
            aria-hidden="true"
            className="absolute w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600/30 to-indigo-600/30 blur-lg animate-pulse"
          />
          <div className="relative p-1 rounded-2xl bg-gradient-to-tr from-violet-500/25 via-indigo-500/15 to-purple-500/10 border border-violet-500/30 shadow-md shadow-violet-500/20">
            <Logo variant="icon" size="md" className="pointer-events-none" />
          </div>
        </div>
      )}

      {/* Статус-бейдж */}
      {badgeText && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase tracking-wider bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 mb-2.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-500" />
          </span>
          <span>{badgeText}</span>
        </div>
      )}

      {/* Заголовок */}
      {title && (
        <div className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground leading-tight mb-1">
          {title}
        </div>
      )}

      {/* Подзаголовок / текущее действие */}
      {description && (
        <div className="text-xs text-muted-foreground max-w-xs transition-colors duration-200">
          {description}
        </div>
      )}

      {/* Прогресс-бар */}
      {showProgress && (
        <div className="w-full mt-5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span className="flex items-center gap-1.5 truncate max-w-[210px] text-left">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse shrink-0" />
              <span className="truncate">{activeStepText}</span>
            </span>
            <span className="tabular-nums font-semibold text-foreground/80 shrink-0 ml-2">
              {Math.round(progress)}%
            </span>
          </div>

          <div className="relative h-1.5 w-full bg-muted/60 dark:bg-muted/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-400 rounded-full transition-all duration-300 ease-out relative overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* Список этапов */}
      {steps.length > 0 && (
        <div className="w-full mt-4 pt-3.5 border-t border-border/40 grid gap-1.5 text-left">
          {steps.map((step, idx) => {
            const isCompleted = idx < activeStepIndex;
            const isCurrent = idx === activeStepIndex;
            return (
              <div
                key={step}
                className={cn(
                  "flex items-center gap-2 text-[11px] transition-all duration-200",
                  isCurrent &&
                    "text-foreground font-medium dark:text-violet-200 text-violet-900",
                  isCompleted && "text-muted-foreground/60 line-through",
                  !isCurrent && !isCompleted && "text-muted-foreground/40",
                )}
              >
                {isCompleted ? (
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    <svg
                      className="w-2 h-2 text-emerald-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                ) : isCurrent ? (
                  <div className="w-3.5 h-3.5 rounded-full bg-violet-500/20 border border-violet-500/60 flex items-center justify-center shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping" />
                  </div>
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-border/60 shrink-0" />
                )}
                <span className="truncate">{step}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Футер сервисов */}
      <div className="mt-4 pt-2.5 border-t border-border/30 w-full flex items-center justify-between text-[10px] font-mono text-muted-foreground/60">
        <span className="flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block" />
          {systemActiveText}
        </span>
        <span>{brandLabel}</span>
      </div>
    </div>
  );

  if (variant === "contained") {
    return (
      <div
        className={cn(
          "w-full h-full min-h-[300px] flex items-center justify-center p-4 relative",
          className,
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed inset-0 min-h-screen w-full flex items-center justify-center p-4",
        "bg-background text-foreground z-50 selection:bg-violet-500/20",
        className,
      )}
    >
      {showBackground && <DynamicBackground />}
      {content}
    </div>
  );
}

export default LoadingScreen;
