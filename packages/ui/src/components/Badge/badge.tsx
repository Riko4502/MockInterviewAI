import { cn } from "@lib/utils";
import * as React from "react";
import { badgeVariants } from "./constants";
import type { BadgeProps } from "./types";

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge };
