"use client";

import { cn } from "@packages/utils";
import * as React from "react";
import { LoadingScreen } from "../LoadingScreen";
import type { AppPreloaderProps } from "./types";

export function AppPreloader({
  children,
  isReady = true,
  minDuration = 1200,
  fadeDuration = 500,
  oncePerSession = false,
  sessionKey = "devsync_preloaded",
  title,
  badgeText,
  description,
  steps,
  systemActiveText,
  brandLabel,
  className,
  onComplete,
  ...props
}: AppPreloaderProps) {
  const [shouldRender, setShouldRender] = React.useState(true);
  const [isFading, setIsFading] = React.useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = React.useState(minDuration === 0);
  const hasStartedFadeRef = React.useRef(false);
  const onCompleteRef = React.useRef(onComplete);
  onCompleteRef.current = onComplete;

  // 1. Проверяем флаг сессии
  React.useEffect(() => {
    if (oncePerSession && typeof window !== "undefined") {
      try {
        if (sessionStorage.getItem(sessionKey)) {
          setShouldRender(false);
        }
      } catch {
        // Игнорируем ошибки sessionStorage
      }
    }
  }, [oncePerSession, sessionKey]);

  // 2. Отсчитываем минимальное время показа
  React.useEffect(() => {
    if (minDuration === 0) {
      setMinTimeElapsed(true);
      return;
    }

    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, minDuration);

    return () => clearTimeout(timer);
  }, [minDuration]);

  // 3. Запускаем растворение когда и минимальное время прошло, и приложение/чанки готовы (isReady === true)
  React.useEffect(() => {
    if (
      !minTimeElapsed ||
      !isReady ||
      !shouldRender ||
      hasStartedFadeRef.current
    ) {
      return;
    }

    hasStartedFadeRef.current = true;

    if (oncePerSession && typeof window !== "undefined") {
      try {
        sessionStorage.setItem(sessionKey, "true");
      } catch {
        // Игнорируем ошибки sessionStorage
      }
    }

    if (fadeDuration === 0) {
      setShouldRender(false);
      onCompleteRef.current?.();
      return;
    }

    setIsFading(true);

    const unmountTimer = setTimeout(() => {
      setShouldRender(false);
      onCompleteRef.current?.();
    }, fadeDuration);

    return () => clearTimeout(unmountTimer);
  }, [
    minTimeElapsed,
    isReady,
    shouldRender,
    oncePerSession,
    sessionKey,
    fadeDuration,
  ]);

  return (
    <>
      {children}
      {shouldRender && (
        <div
          aria-hidden={isFading}
          data-testid="app-preloader"
          className={cn(
            "fixed inset-0 z-50 transition-all ease-out",
            isFading
              ? "opacity-0 pointer-events-none scale-[1.01]"
              : "opacity-100",
            className,
          )}
          style={{ transitionDuration: `${fadeDuration}ms` }}
        >
          <LoadingScreen
            title={title}
            badgeText={badgeText}
            description={description}
            steps={steps}
            systemActiveText={systemActiveText}
            brandLabel={brandLabel}
            {...props}
          />
        </div>
      )}
    </>
  );
}

export default AppPreloader;
