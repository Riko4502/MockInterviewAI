import * as React from "react";
import { type VariantProps } from "class-variance-authority";
import { iconVariants } from "./constants";

export type IconProps = React.ComponentPropsWithoutRef<"svg"> &
  VariantProps<typeof iconVariants>;
