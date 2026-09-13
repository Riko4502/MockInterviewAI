"use client";

import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Определяет, соответствует ли ширина окна мобильному брейкпоинту (`< 768px`).
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(
      `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
    );
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    mediaQuery.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  return Boolean(isMobile);
}
