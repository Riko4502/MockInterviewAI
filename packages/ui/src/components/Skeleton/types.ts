import type { VariantProps } from "@packages/utils";
import type * as React from "react";
import type { skeletonVariants } from "./constants";

export interface SkeletonProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof skeletonVariants> {}
