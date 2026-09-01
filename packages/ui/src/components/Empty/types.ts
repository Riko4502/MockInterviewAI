import type { VariantProps } from "@packages/utils";
import type * as React from "react";
import type { emptyVariants } from "./constants";

export type EmptyVariant = NonNullable<
  VariantProps<typeof emptyVariants>["variant"]
>;
export type EmptySize = NonNullable<VariantProps<typeof emptyVariants>["size"]>;

/**
 * Свойства корневого компонента Empty.
 */
export interface EmptyProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof emptyVariants> {
  /**
   * Заголовок пустого состояния (при использовании shorthand-синтаксиса).
   */
  title?: React.ReactNode;
  /**
   * Описание / подсказка пустого состояния (при использовании shorthand-синтаксиса).
   */
  description?: React.ReactNode;
  /**
   * Иконка или изображение (при использовании shorthand-синтаксиса).
   */
  media?: React.ReactNode;
  /**
   * Кнопка или блок действий (при использовании shorthand-синтаксиса).
   */
  action?: React.ReactNode;
}

/**
 * Свойства слота для иконки/иллюстрации Empty.Media.
 */
export type EmptyMediaProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Свойства заголовка Empty.Title.
 */
export type EmptyTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

/**
 * Свойства описания Empty.Description.
 */
export type EmptyDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

/**
 * Свойства блока действий Empty.Action.
 */
export type EmptyActionProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Свойства произвольного контента Empty.Content.
 */
export type EmptyContentProps = React.HTMLAttributes<HTMLDivElement>;
