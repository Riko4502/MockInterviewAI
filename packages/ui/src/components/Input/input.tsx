import { cn } from "@lib/utils";
import * as React from "react";


function Input({ className, type, ...props }: React.ComponentProps<"input">) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                "flex h-[46px] w-full min-w-0 rounded-lg border border-input bg-background px-4 py-[13px] text-sm",
                "text-foreground placeholder:text-muted-foreground",
                "outline-none transition-[color,box-shadow]",
                "selection:bg-primary selection:text-primary-foreground",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
                "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
            {...props}
        />
    );
}

export { Input };