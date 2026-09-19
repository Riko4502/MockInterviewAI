import type { VariantProps } from "@packages/utils";
import type * as React from "react";
import type { badgeVariants } from "./constants";

export type BadgeVariant = NonNullable<
  VariantProps<typeof badgeVariants>["variant"]
>;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}
