import type { VariantProps } from "class-variance-authority";
import type * as React from "react";
import type { ICON_SIZE_MAP, iconVariants } from "./constants";

export type IconSize = keyof typeof ICON_SIZE_MAP;

export type IconProps = React.ComponentPropsWithoutRef<"svg"> &
  VariantProps<typeof iconVariants>;
