"use client";

import { DynamicBackground } from "@components/Background/DynamicBackground";
import { GlobalSpotlight } from "@components/Background/GlobalSpotlight";
import { Button } from "@components/Button";
import { Typography } from "@components/Typography";
import { WindowHeader } from "@components/WindowHeader";
import { ArrowRightIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import type React from "react";

export interface NotFoundViewProps {
  /** Текст статус-бейджа */
  badgeText?: React.ReactNode;
  /** Главный заголовок */
  title?: React.ReactNode;
  /** Описание */
  description?: React.ReactNode;
  /** Имя файла в шапке терминала */
  terminalFilename?: string;
  /** Текст комментария в коде терминала */
  codeComment?: React.ReactNode;
  /** Текст ошибки в терминале */
  codeError?: React.ReactNode;
  /** Текст кнопки возврата */
  actionText?: React.ReactNode;
  /** Ссылка для кнопки возврата */
  actionHref?: string;
  /** Кастомный элемент кнопки возврата (например, NextLink c Button) */
  actionElement?: React.ReactNode;
  /** Кастомный элемент логотипа вверху */
  logoElement?: React.ReactNode;
  /** Отображать ли динамический анимированный фон */
  showBackground?: boolean;
  /** Отображать ли интерактивный курсорный spotlight */
  showSpotlight?: boolean;
  /** Дополнительные CSS-классы для контейнера */
  className?: string;
}

export function NotFoundView({
  badgeText = "СИСТЕМНЫЙ СБОЙ // МАРШРУТ НЕ НАЙДЕН",
  title = "Маршрут не найден",
  description = "Запрашиваемый адрес отсутствует в карте маршрутизации или был перемещен.",
  terminalFilename = "route-resolver.log",
  codeComment = "Route matching failed across active branches",
  codeError = "ERR_404_PAGE_NOT_FOUND: Path resolution failed",
  actionText = "Вернуться на главную",
  actionHref = "/",
  actionElement,
  logoElement,
  showBackground = true,
  showSpotlight = true,
  className,
}: NotFoundViewProps) {
  return (
    <div
      className={cn(
        "min-h-screen text-foreground flex flex-col font-sans relative selection:bg-violet-500/20 selection:text-violet-600 dark:selection:text-violet-300 bg-background overflow-x-hidden transition-colors",
        className,
      )}
    >
      {/* 1. Dynamic Animated Background with Neon Orbs & Cyber Grid */}
      {showBackground && <DynamicBackground />}

      {/* 2. Interactive Cursor Spotlight */}
      {showSpotlight && <GlobalSpotlight />}

      {/* 3. Center 404 Hero Container */}
      <main className="flex-1 relative z-10 flex items-center justify-center px-4 py-16 sm:py-24">
        {/* Ambient Center Glow */}
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-violet-600/20 via-purple-600/15 to-sky-500/10 rounded-full blur-[140px] pointer-events-none -z-10"
        />

        <div className="text-center max-w-2xl mx-auto space-y-6 w-full flex flex-col items-center">
          {/* Top Logo slot if provided */}
          {logoElement && <div className="mb-2 sm:mb-4">{logoElement}</div>}

          {/* Cyber Status Badge */}
          {badgeText && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 backdrop-blur-md text-xs font-semibold tracking-wider text-violet-600 dark:text-violet-400 uppercase font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75 motion-reduce:hidden" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
              </span>
              <span>{badgeText}</span>
            </div>
          )}

          {/* Large Floating 404 Display */}
          <div className="relative select-none py-1">
            <span className="text-8xl sm:text-9xl md:text-[11rem] font-black tracking-tighter text-gradient-purple drop-shadow-[0_0_40px_rgba(168,85,247,0.35)] animate-float inline-block leading-none">
              404
            </span>
          </div>

          {/* Heading */}
          {title && (
            <Typography.H1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
              {title}
            </Typography.H1>
          )}

          {/* Description */}
          {description && (
            <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-lg mx-auto leading-relaxed">
              {description}
            </p>
          )}

          {/* Terminal / Code Log Card */}
          <div className="mt-8 mx-auto w-full max-w-lg rounded-2xl glass-panel border border-border dark:border-white/10 p-5 text-left font-mono text-xs sm:text-sm shadow-2xl relative overflow-hidden group bg-card/85 dark:bg-transparent">
            <WindowHeader
              className="pb-3 border-b border-border dark:border-white/10 mb-3 text-muted-foreground p-0 bg-transparent"
              actions={
                <span className="text-[10px] text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20 font-mono">
                  HTTP 404
                </span>
              }
            >
              <span className="ml-1 text-muted-foreground text-[11px]">
                {terminalFilename}
              </span>
            </WindowHeader>
            <div className="space-y-1.5 text-foreground/90">
              <div className="flex items-start gap-2">
                <span className="text-violet-400 select-none">&gt;</span>
                <span>
                  <span className="text-pink-400">const</span> targetNode ={" "}
                  <span className="text-indigo-400">Router</span>.
                  <span className="text-cyan-400">resolve</span>(pathname);
                </span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground italic">
                <span className="select-none">{"//"}</span>
                <span>{codeComment}</span>
              </div>
              <div className="flex items-start gap-2 text-rose-400 font-semibold">
                <span className="select-none">!</span>
                <span>{codeError}</span>
              </div>
            </div>
          </div>

          {/* Action Button CTA */}
          <div className="pt-6">
            {actionElement ? (
              actionElement
            ) : (
              <Button asChild size="lg" className="rounded-full gap-2 px-8">
                <a href={actionHref}>
                  <span>{actionText}</span>
                  <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default NotFoundView;
