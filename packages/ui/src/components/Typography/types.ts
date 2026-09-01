import type { VariantProps } from "@packages/utils";
import type * as React from "react";
import type { typographyVariants } from "./constants";

export type TypographyVariant = NonNullable<
  VariantProps<typeof typographyVariants>["variant"]
>;

/**
 * Свойства полиморфного компонента типографики (Typography).
 */
export type TypographyProps<T extends React.ElementType = "p"> = {
  /**
   * Пользовательский HTML-тег или React-компонент (полиморфизм).
   */
  as?: T;
  /**
   * Использовать дочерний элемент как корневой слот (asChild).
   * @default false
   */
  asChild?: boolean;
  /**
   * Вариант визуального оформления типографики.
   * @default "p"
   */
  variant?: TypographyVariant;
  /**
   * Содержимое элемента.
   */
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, "as">;

/**
 * Свойства подкомпонентов Typography (H1, H2, P, Lead, Muted и т.д.).
 */
export type TypographySubComponentProps<T extends React.ElementType> = Omit<
  TypographyProps<T>,
  "variant"
>;
