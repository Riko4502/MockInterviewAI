import { cn } from "@lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

const inputVariants = cva(
  "flex h-[46px] w-full min-w-0 rounded-lg border border-input bg-background px-4 py-[13px] text-sm text-foreground placeholder:text-muted-foreground outline-none transition-[color,box-shadow] selection:bg-primary selection:text-primary-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {},
    defaultVariants: {},
  },
);

export type InputProps = React.ComponentProps<"input"> &
  VariantProps<typeof inputVariants>;

function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ className }))}
      {...props}
    />
  );
}

export { Input };
