import type { VariantProps } from "@packages/utils";
import type * as React from "react";
import type { linkVariants } from "./constants";

/**
 * Свойства компонента ссылки (Link).
 */
export interface LinkProps
  extends React.ComponentProps<"a">,
    VariantProps<typeof linkVariants> {
  /**
   * Заменять ли корневой элемент дочерним (паттерн Radix asChild).
   * Позволяет оборачивать кастомные ссылки роутеров (например, Next.js `<Link>` или React Router `<Link>`).
   * @default false
   */
  asChild?: boolean;

  /**
   * Открывать ли ссылку во внешней вкладке (`target="_blank"` + `rel="noopener noreferrer"`).
   * @default false
   */
  external?: boolean;

  /**
   * Отображать ли индикатор внешней ссылки (иконку стрелки) справа от текста.
   * @default false
   */
  showExternalIcon?: boolean;

  /**
   * Блокирует ссылку, отключая события клика и устанавливая `aria-disabled="true"`.
   * @default false
   */
  disabled?: boolean;
}
