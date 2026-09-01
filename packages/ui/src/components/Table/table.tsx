import { cn } from "@packages/utils";
import { TABLE_STYLES } from "./constants";
import type {
  TableBodyProps,
  TableCaptionProps,
  TableCellProps,
  TableFooterProps,
  TableHeaderProps,
  TableHeadProps,
  TableProps,
  TableRowProps,
} from "./types";

function TableRoot({
  className,
  containerClassName,
  containerStyle,
  ...props
}: TableProps) {
  return (
    <div
      data-slot="table-container"
      style={containerStyle}
      className={cn(TABLE_STYLES.container, containerClassName)}
    >
      <table
        data-slot="table"
        className={cn(TABLE_STYLES.root, className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: TableHeaderProps) {
  return (
    <thead
      data-slot="table-header"
      className={cn(TABLE_STYLES.header, className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: TableBodyProps) {
  return (
    <tbody
      data-slot="table-body"
      className={cn(TABLE_STYLES.body, className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: TableFooterProps) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(TABLE_STYLES.footer, className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: TableRowProps) {
  return (
    <tr
      data-slot="table-row"
      className={cn(TABLE_STYLES.row, className)}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: TableHeadProps) {
  return (
    <th
      data-slot="table-head"
      className={cn(TABLE_STYLES.head, className)}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: TableCellProps) {
  return (
    <td
      data-slot="table-cell"
      className={cn(TABLE_STYLES.cell, className)}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: TableCaptionProps) {
  return (
    <caption
      data-slot="table-caption"
      className={cn(TABLE_STYLES.caption, className)}
      {...props}
    />
  );
}

export const Table = Object.assign(TableRoot, {
  Header: TableHeader,
  Body: TableBody,
  Footer: TableFooter,
  Row: TableRow,
  Head: TableHead,
  Cell: TableCell,
  Caption: TableCaption,
});
