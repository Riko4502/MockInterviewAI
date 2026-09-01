"use client";

import { cn } from "@packages/utils";
import { Separator as SeparatorPrimitive } from "radix-ui";
import { SEPARATOR_STYLES, separatorVariants } from "./constants";
import type { SeparatorProps } from "./types";

/**
 * Компонент визуального разделителя (Separator).
 *
 * Поддерживает:
 * - Горизонтальную и вертикальную ориентацию (`orientation`);
 * - Стили линий (`default`, `muted`, `dashed`, `dotted`);
 * - Текстовые подписи по центру (`label` или `children`);
 * - Доступность WAI-ARIA (`decorative`).
 */
function Separator({
  className,
  orientation = "horizontal",
  variant = "default",
  decorative = true,
  label,
  children,
  ...props
}: SeparatorProps) {
  const resolvedOrientation = orientation ?? "horizontal";
  const textContent = label ?? children;

  if (textContent && resolvedOrientation === "horizontal") {
    return (
      <div
        role="none"
        data-slot="separator-container"
        className={cn(SEPARATOR_STYLES.container, className)}
      >
        <div className={SEPARATOR_STYLES.line}>
          <SeparatorPrimitive.Root
            data-slot="separator"
            data-orientation={resolvedOrientation}
            data-variant={variant}
            decorative={decorative}
            orientation={resolvedOrientation}
            className={cn(
              separatorVariants({
                orientation: resolvedOrientation,
                variant,
              }),
            )}
            {...props}
          />
        </div>
        <span data-slot="separator-label" className={SEPARATOR_STYLES.label}>
          {textContent}
        </span>
      </div>
    );
  }

  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      data-orientation={resolvedOrientation}
      data-variant={variant}
      decorative={decorative}
      orientation={resolvedOrientation}
      className={cn(
        separatorVariants({
          orientation: resolvedOrientation,
          variant,
          className,
        }),
      )}
      {...props}
    />
  );
}

export { Separator };
