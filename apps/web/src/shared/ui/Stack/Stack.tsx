import clsx from "clsx";
import {
  type DetailedHTMLProps,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";

export type StackDirection = "row" | "column";
export type StackJustify = "start" | "center" | "end" | "between" | "around";
export type StackAlign = "start" | "center" | "end" | "stretch";
export type StackGap = "4" | "8" | "16" | "24" | "32" | "48" | "64";

export type StackTag =
  | "div"
  | "section"
  | "article"
  | "aside"
  | "main"
  | "nav"
  | "header";

const directionClasses: Record<StackDirection, string> = {
  row: "flex-row",
  column: "flex-col",
};

const justifyClasses: Record<StackJustify, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
};

const alignClasses: Record<StackAlign, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

const gapClasses: Record<StackGap, string> = {
  4: "gap-1",
  8: "gap-2",
  16: "gap-4",
  24: "gap-6",
  32: "gap-8",
  48: "gap-12",
  64: "gap-16",
};

type DivProps = DetailedHTMLProps<
  HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
>;

export interface StackProps extends DivProps {
  className?: string;
  children: ReactNode;
  direction?: StackDirection;
  justify?: StackJustify;
  align?: StackAlign;
  gap?: StackGap;
  max?: boolean;
  tag?: StackTag;
  wrap?: boolean;
}

export const Stack = forwardRef<HTMLDivElement, StackProps>((props, ref) => {
  const {
    className,
    children,
    direction = "row",
    justify = "start",
    align = "start",
    gap,
    max,
    tag: Tag = "div",
    wrap,
    ...otherProps
  } = props;

  return (
    <Tag
      ref={ref}
      className={clsx(
        "flex",
        directionClasses[direction],
        justifyClasses[justify],
        alignClasses[align],
        gap && gapClasses[gap],
        max && "w-full",
        wrap && "flex-wrap",
        className,
      )}
      {...otherProps}
    >
      {children}
    </Tag>
  );
});

Stack.displayName = "Stack";
