import { cn, cva, type VariantProps } from "@packages/utils";
import type * as React from "react";

const textareaVariants = cva(
  "flex min-h-[120px] w-full min-w-0 resize-y rounded-lg border border-input bg-background px-4 py-[13px] text-sm text-foreground placeholder:text-muted-foreground outline-none transition-[color,box-shadow] selection:bg-primary selection:text-primary-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {},
    defaultVariants: {},
  },
);

export type TextareaProps = React.ComponentProps<"textarea"> &
  VariantProps<typeof textareaVariants>;

function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(textareaVariants({ className }))}
      {...props}
    />
  );
}

export { Textarea };
