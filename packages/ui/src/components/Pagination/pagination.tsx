import { ArrowDownIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import { buttonVariants } from "../Button/button";
import { PAGINATION_STYLES } from "./constants";
import type {
  PaginationContentProps,
  PaginationEllipsisProps,
  PaginationItemProps,
  PaginationLinkProps,
  PaginationNextProps,
  PaginationPreviousProps,
  PaginationProps,
} from "./types";

/**
 * Корневой контейнер пагинации (Pagination).
 */
function PaginationRoot({ className, ...props }: PaginationProps) {
  return (
    <nav
      aria-label="pagination"
      data-slot="pagination"
      className={cn(PAGINATION_STYLES.root, className)}
      {...props}
    />
  );
}

/**
 * Список элементов пагинации (Pagination.Content).
 */
function PaginationContent({ className, ...props }: PaginationContentProps) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn(PAGINATION_STYLES.content, className)}
      {...props}
    />
  );
}

/**
 * Отдельный элемент списка пагинации (Pagination.Item).
 */
function PaginationItem({ className, ...props }: PaginationItemProps) {
  return (
    <li
      data-slot="pagination-item"
      className={cn(PAGINATION_STYLES.item, className)}
      {...props}
    />
  );
}

/**
 * Ссылка или кнопка страницы (Pagination.Link).
 */
function PaginationLink({
  className,
  isActive = false,
  size = "icon",
  variant,
  rounded = "default",
  ...props
}: PaginationLinkProps) {
  const resolvedVariant = variant ?? (isActive ? "outline" : "ghost");

  return (
    <a
      aria-current={isActive ? "page" : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      className={cn(
        buttonVariants({
          variant: resolvedVariant,
          size,
          rounded,
        }),
        className,
      )}
      {...props}
    />
  );
}

/**
 * Кнопка перехода на предыдущую страницу (Pagination.Previous).
 */
function PaginationPrevious({
  className,
  size = "default",
  label = "Назад",
  ...props
}: PaginationPreviousProps) {
  return (
    <PaginationLink
      aria-label="Перейти на предыдущую страницу"
      size={size}
      className={cn("gap-1.5 pl-2.5", className)}
      {...props}
    >
      <ArrowDownIcon size="xs" className="rotate-90 size-3 shrink-0" />
      {label && <span>{label}</span>}
    </PaginationLink>
  );
}

/**
 * Кнопка перехода на следующую страницу (Pagination.Next).
 */
function PaginationNext({
  className,
  size = "default",
  label = "Вперед",
  ...props
}: PaginationNextProps) {
  return (
    <PaginationLink
      aria-label="Перейти на следующую страницу"
      size={size}
      className={cn("gap-1.5 pr-2.5", className)}
      {...props}
    >
      {label && <span>{label}</span>}
      <ArrowDownIcon size="xs" className="-rotate-90 size-3 shrink-0" />
    </PaginationLink>
  );
}

/**
 * Элемент многоточия для пропуска страниц (Pagination.Ellipsis).
 */
function PaginationEllipsis({ className, ...props }: PaginationEllipsisProps) {
  return (
    <span
      aria-hidden="true"
      data-slot="pagination-ellipsis"
      className={cn(PAGINATION_STYLES.ellipsis, className)}
      {...props}
    >
      ...
    </span>
  );
}

export const Pagination = Object.assign(PaginationRoot, {
  Content: PaginationContent,
  Item: PaginationItem,
  Link: PaginationLink,
  Previous: PaginationPrevious,
  Next: PaginationNext,
  Ellipsis: PaginationEllipsis,
});
