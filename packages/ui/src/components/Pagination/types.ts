import type * as React from "react";
import type { ButtonProps } from "../Button/button";

/**
 * Свойства корневого контейнера навигации по страницам (Pagination).
 */
export type PaginationProps = React.ComponentProps<"nav">;

/**
 * Свойства списка элементов пагинации (Pagination.Content).
 */
export type PaginationContentProps = React.ComponentProps<"ul">;

/**
 * Свойства отдельного элемента списка пагинации (Pagination.Item).
 */
export type PaginationItemProps = React.ComponentProps<"li">;

/**
 * Свойства ссылки/кнопки страницы (Pagination.Link).
 */
export type PaginationLinkProps = {
  /**
   * Является ли страница текущей активной.
   * @default false
   */
  isActive?: boolean;
} & Partial<Pick<ButtonProps, "size" | "variant" | "rounded">> &
  React.ComponentProps<"a">;

/**
 * Свойства кнопки перехода на предыдущую страницу (Pagination.Previous).
 */
export interface PaginationPreviousProps extends PaginationLinkProps {
  /**
   * Текстовая подпись кнопки.
   * @default "Назад"
   */
  label?: React.ReactNode;
}

/**
 * Свойства кнопки перехода на следующую страницу (Pagination.Next).
 */
export interface PaginationNextProps extends PaginationLinkProps {
  /**
   * Текстовая подпись кнопки.
   * @default "Вперед"
   */
  label?: React.ReactNode;
}

/**
 * Свойства элемента многоточия для пропуска страниц (Pagination.Ellipsis).
 */
export type PaginationEllipsisProps = React.ComponentProps<"span">;
