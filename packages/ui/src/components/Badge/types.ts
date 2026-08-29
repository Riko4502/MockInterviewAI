import type { VariantProps } from "class-variance-authority";
import type * as React from "react";
import type { badgeVariants } from "./constants";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}
