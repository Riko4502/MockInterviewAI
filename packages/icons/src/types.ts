import type { VariantProps } from "class-variance-authority";
import type * as React from "react";
import type { iconVariants } from "./constants";

export type IconProps = React.ComponentPropsWithoutRef<"svg"> &
  VariantProps<typeof iconVariants>;
