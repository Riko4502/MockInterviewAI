import { cn } from "@packages/utils";
import { kbdVariants } from "./constants";
import type { KbdProps } from "./types";

/**
 * Компонент для отображения клавиш клавиатуры (например, в подсказках горячих клавиш: Ctrl + K).
 */
function Kbd({ className, variant, size, ...props }: KbdProps) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(kbdVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Kbd };
