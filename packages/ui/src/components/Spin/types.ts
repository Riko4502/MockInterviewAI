import type { VariantProps } from "class-variance-authority";
import type * as React from "react";
import type { spinVariants } from "./constants";

export type SpinVariant = NonNullable<
  VariantProps<typeof spinVariants>["variant"]
>;
export type SpinSize = NonNullable<VariantProps<typeof spinVariants>["size"]>;

/**
 * Свойства компонента Spin (индикатора загрузки).
 */
export interface SpinProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "color">,
    VariantProps<typeof spinVariants> {
  /**
   * Активно ли состояние загрузки (вращение спиннера).
   * @default true
   */
  spinning?: boolean;
  /**
   * Текстовая подсказка или описание процесса загрузки, отображаемое рядом/под спиннером.
   */
  tip?: React.ReactNode;
  /**
   * Пользовательский элемент-индикатор вместо стандартной иконки спиннера.
   */
  indicator?: React.ReactNode;
  /**
   * Задержка в миллисекундах перед отображением индикатора загрузки (предотвращает мерцание при быстрых запросах).
   */
  delay?: number;
  /**
   * Отображение в виде полноэкранного блокирующего оверлея.
   * @default false
   */
  fullscreen?: boolean;
  /**
   * Дополнительный класс стилей для внешнего контейнера-обертки при наличии children.
   */
  wrapperClassName?: string;
  /**
   * Дочерние элементы для оборачивания. При наличии children компонент работает как оверлей-контейнер.
   */
  children?: React.ReactNode;
}
