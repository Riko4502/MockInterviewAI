import type { VariantProps } from "@packages/utils";
import type * as React from "react";
import type { kbdVariants } from "./constants";

/**
 * Свойства компонента Kbd.
 */
export interface KbdProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof kbdVariants> {}
