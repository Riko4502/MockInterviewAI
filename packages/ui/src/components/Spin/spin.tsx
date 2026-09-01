"use client";

import { cn } from "@packages/utils";
import { Loader2Icon } from "lucide-react";
import * as React from "react";
import { SPIN_STYLES, spinVariants } from "./constants";
import type { SpinProps } from "./types";

/**
 * Компонент индикатора загрузки (Spin / Spinner).
 *
 * Поддерживает:
 * - Одиночный режим отображения (inline spinner);
 * - Режим оверлея над дочерними элементами (при передаче children);
 * - Полноэкранный режим блокирующей загрузки (fullscreen);
 * - Текстовые подписи (tip);
 * - Кастомные индикаторы (indicator);
 * - Задержку перед показом (delay).
 */
function Spin({
  spinning = true,
  size = "default",
  variant = "default",
  tip,
  indicator,
  delay,
  fullscreen = false,
  wrapperClassName,
  className,
  children,
  ...props
}: SpinProps) {
  const [shouldSpin, setShouldSpin] = React.useState(delay ? false : spinning);

  // Обработка задержки (delay) для предотвращения мерцания интерфейса
  React.useEffect(() => {
    if (!delay) {
      setShouldSpin(spinning);
      return;
    }

    if (spinning) {
      const timer = setTimeout(() => {
        setShouldSpin(true);
      }, delay);
      return () => clearTimeout(timer);
    }

    setShouldSpin(false);
  }, [spinning, delay]);

  // Стандартная иконка спиннера
  const defaultSpinner = (
    <Loader2Icon
      aria-hidden="true"
      data-slot="spin-indicator"
      className={cn(spinVariants({ variant, size }), className)}
    />
  );

  const spinnerContent = indicator ?? defaultSpinner;

  // 1. Полноэкранный режим блокирующей загрузки
  if (fullscreen) {
    if (!shouldSpin) {
      return null;
    }

    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        data-slot="spin-fullscreen"
        className={cn(SPIN_STYLES.fullscreen, className)}
        {...props}
      >
        {spinnerContent}
        {tip && (
          <span data-slot="spin-tip" className={SPIN_STYLES.tip}>
            {tip}
          </span>
        )}
      </div>
    );
  }

  // 2. Режим контейнера-обертки для дочерних компонентов (children)
  if (children !== undefined && children !== null) {
    return (
      <div
        data-slot="spin-wrapper"
        className={cn(SPIN_STYLES.wrapper, wrapperClassName)}
      >
        {shouldSpin && (
          <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            data-slot="spin-overlay"
            className={SPIN_STYLES.overlay}
            {...props}
          >
            {spinnerContent}
            {tip && (
              <span data-slot="spin-tip" className={SPIN_STYLES.tip}>
                {tip}
              </span>
            )}
          </div>
        )}
        <div
          data-slot="spin-content"
          className={cn(
            SPIN_STYLES.content,
            shouldSpin && SPIN_STYLES.contentBlurred,
          )}
        >
          {children}
        </div>
      </div>
    );
  }

  // 3. Одиночный режим (inline spinner)
  if (!shouldSpin) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-slot="spin"
      className={cn("inline-flex items-center gap-2", className)}
      {...props}
    >
      {spinnerContent}
      {tip && (
        <span data-slot="spin-tip" className={SPIN_STYLES.tip}>
          {tip}
        </span>
      )}
    </div>
  );
}

export { Spin, Spin as Spinner };
