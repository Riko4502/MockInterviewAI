import { cn } from "@packages/ui/lib/utils";
import {
  type DetailedHTMLProps,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import {
  alignClasses,
  directionClasses,
  gapClasses,
  justifyClasses,
  type StackAlign,
  type StackDirection,
  type StackGap,
  type StackJustify,
  type StackTag,
} from "./constants";

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
      className={cn(
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
