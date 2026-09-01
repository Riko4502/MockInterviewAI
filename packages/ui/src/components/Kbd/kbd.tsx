import { cn } from "@packages/utils";
import { kbdVariants } from "./constants";
import type { KbdProps } from "./types";

/**
 * Компонент для отображения клавиш клавиатуры (например, в подсказках горячих клавиш: Ctrl + K).
 */
function Kbd({ className, size, ...props }: KbdProps) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(kbdVariants({ size }), className)}
      {...props}
    />
  );
}

export { Kbd };
