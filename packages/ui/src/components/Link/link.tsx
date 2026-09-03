"use client";

import { ArrowRightIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import { Slot } from "radix-ui";
import * as React from "react";
import { linkVariants } from "./constants";
import type { LinkProps } from "./types";

/**
 * Компонент доступной интерактивной ссылки (Link).
 *
 * Особенности:
 * - Поддержка цветовых тем (`default`, `muted`, `destructive`, `subtle`);
 * - Настройка подчеркивания (`always`, `hover`, `none`);
 * - Управление внешними ссылками (`external`, `showExternalIcon`);
 * - Поддержка полиморфизма (`asChild`) для интеграции с Next.js Link и React Router;
 * - Состояние блокировки (`disabled`) с корректными атрибутами доступности.
 */
const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  (
    {
      className,
      variant,
      underline,
      size,
      asChild = false,
      external = false,
      showExternalIcon = false,
      disabled = false,
      target,
      rel,
      onClick,
      children,
      ...props
    },
    ref,
  ) => {
    const isSlot = asChild && React.isValidElement(children);
    const Comp = isSlot ? Slot.Root : "a";

    const resolvedTarget = external ? "_blank" : target;
    const resolvedRel = external ? rel || "noopener noreferrer" : rel;

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (disabled) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    };

    return (
      <Comp
        ref={ref}
        data-slot="link"
        data-variant={variant}
        data-disabled={disabled}
        aria-disabled={disabled ? "true" : undefined}
        tabIndex={disabled ? -1 : undefined}
        target={resolvedTarget}
        rel={resolvedRel}
        onClick={handleClick}
        className={cn(
          linkVariants({ variant, underline, size }),
          disabled && "pointer-events-none opacity-50 cursor-not-allowed",
          className,
        )}
        {...props}
      >
        {children}
        {showExternalIcon && !isSlot && (
          <ArrowRightIcon size="xs" className="size-3 shrink-0 inline-block" />
        )}
      </Comp>
    );
  },
);

Link.displayName = "Link";

export { Link, linkVariants };
