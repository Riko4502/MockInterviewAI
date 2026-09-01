import type * as React from "react";

export interface TableProps extends React.ComponentProps<"table"> {
  /**
   * Дополнительные CSS-классы для внешнего контейнера таблицы.
   */
  containerClassName?: string;
  /**
   * Стили для внешнего контейнера таблицы (например, maxHeight для sticky header).
   */
  containerStyle?: React.CSSProperties;
}

export type TableHeaderProps = React.ComponentProps<"thead">;
export type TableBodyProps = React.ComponentProps<"tbody">;
export type TableFooterProps = React.ComponentProps<"tfoot">;
export type TableRowProps = React.ComponentProps<"tr">;
export type TableHeadProps = React.ComponentProps<"th">;
export type TableCellProps = React.ComponentProps<"td">;
export type TableCaptionProps = React.ComponentProps<"caption">;
