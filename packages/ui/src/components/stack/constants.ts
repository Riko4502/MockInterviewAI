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

export const directionClasses: Record<StackDirection, string> = {
  row: "flex-row",
  column: "flex-col",
};

export const justifyClasses: Record<StackJustify, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
};

export const alignClasses: Record<StackAlign, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

export const gapClasses: Record<StackGap, string> = {
  4: "gap-1",
  8: "gap-2",
  16: "gap-4",
  24: "gap-6",
  32: "gap-8",
  48: "gap-12",
  64: "gap-16",
};
