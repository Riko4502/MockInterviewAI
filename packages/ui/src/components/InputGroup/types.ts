import type * as React from "react";

/**
 * Свойства корневого контейнера InputGroup.
 */
export interface InputGroupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "prefix"> {
  /**
   * Режим прикрепленных внешних аддонов и кнопок (склейка границ).
   * @default false
   */
  attached?: boolean;
  /**
   * Слот или иконка префикса слева внутри поля ввода (shorthand).
   */
  prefix?: React.ReactNode;
  /**
   * Слот, иконка или кнопка суффикса справа внутри поля ввода (shorthand).
   */
  suffix?: React.ReactNode;
}

/**
 * Свойства слота префикса InputGroup.Prefix.
 */
export type InputGroupPrefixProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Свойства слота суффикса InputGroup.Suffix.
 */
export type InputGroupSuffixProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Свойства прикрепляемого внешнего текстового аддона InputGroup.Addon.
 */
export type InputGroupAddonProps = React.HTMLAttributes<HTMLDivElement>;
