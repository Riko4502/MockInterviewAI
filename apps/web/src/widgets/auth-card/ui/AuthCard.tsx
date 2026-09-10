import { Logo, Typography } from "@packages/ui";
import type * as React from "react";
import { DynamicBackground } from "@/shared/ui";

export interface AuthCardProps {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Презентационный Server Component карточки аутентификации (Login / Register).
 * Инкапсулирует позиционирование логотипа с перекрытием (40–50% overlap),
 * полупрозрачную подложку с размытием (glassmorphism) и слоты для формы и подвала.
 */
export function AuthCard({ title, children, footer }: AuthCardProps) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-16">
      {/* 1. Атмосферный динамический фон */}
      <DynamicBackground />

      {/* 2. Контейнер карточки с позиционированием Logo */}
      <div className="relative w-full max-w-sm">
        {/* Брендовый Logo, выступающий на 40–50% над верхней гранью карточки */}
        <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 z-10">
          <Logo asChild variant="full" size="lg" />
        </div>

        {/* Премиальная стеклянная карточка */}
        <div className="w-full rounded-2xl border border-white/[0.08] bg-card/75 backdrop-blur-xl p-8 pt-12 shadow-2xl shadow-violet-950/25">
          <Typography.H1 className="mb-6 text-center text-2xl lg:text-3xl font-semibold text-foreground">
            {title}
          </Typography.H1>

          {/* Слот клиентской формы (LoginForm / RegisterForm) */}
          {children}

          {/* Слот перекрестной навигации */}
          {footer && (
            <div className="mt-6 border-t border-border/50 pt-4 text-center">
              {footer}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
