import type { VariantProps } from "@packages/utils";
import type { HTMLAttributes } from "react";
import type { alertVariants } from "./constants";

/**
 * Свойства корневого контейнера Alert.
 */
export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

/**
 * Свойства заголовка Alert.
 */
export interface AlertTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

/**
 * Свойства текстового описания Alert.
 */
export interface AlertDescriptionProps
  extends HTMLAttributes<HTMLParagraphElement> {}
