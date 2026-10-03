"use client";

import * as React from "react";

export const DEFAULT_MOBILE_BREAKPOINT = 768;

/**
 * Хук для реактивного определения мобильного экрана на основе ширины окна и медиа-запросов.
 *
 * @param breakpoint - Порог в пикселях для мобильного режима (по умолчанию 768px).
 * @returns `true`, если ширина окна меньше `breakpoint`, иначе `false`.
 */
export function useMobile(
  breakpoint: number = DEFAULT_MOBILE_BREAKPOINT,
): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const query = `(max-width: ${breakpoint - 1}px)`;
    const mediaQuery = window.matchMedia(query);

    const updateMatch = () => {
      setIsMobile(window.innerWidth < breakpoint || mediaQuery.matches);
    };

    updateMatch();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateMatch);
    } else if (
      typeof (
        mediaQuery as unknown as { addListener?: (cb: () => void) => void }
      ).addListener === "function"
    ) {
      (
        mediaQuery as unknown as { addListener: (cb: () => void) => void }
      ).addListener(updateMatch);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", updateMatch);
      } else if (
        typeof (
          mediaQuery as unknown as {
            removeListener?: (cb: () => void) => void;
          }
        ).removeListener === "function"
      ) {
        (
          mediaQuery as unknown as {
            removeListener: (cb: () => void) => void;
          }
        ).removeListener(updateMatch);
      }
    };
  }, [breakpoint]);

  return Boolean(isMobile);
}

/** Алиас для совместимости с `useIsMobile`. */
export const useIsMobile = useMobile;
