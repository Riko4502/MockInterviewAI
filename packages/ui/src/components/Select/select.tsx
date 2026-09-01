"use client";

import { ArrowDownIcon, ArrowUpIcon, CheckIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import { Select as SelectPrimitive } from "radix-ui";
import * as React from "react";
import {
  selectContentVariants,
  selectItemVariants,
  selectTriggerVariants,
} from "./constants";
import type {
  SelectContentProps,
  SelectContextValue,
  SelectGroupProps,
  SelectItemProps,
  SelectLabelProps,
  SelectProps,
  SelectScrollDownButtonProps,
  SelectScrollUpButtonProps,
  SelectSeparatorProps,
  SelectTriggerProps,
  SelectValueProps,
} from "./types";

const SelectContext = React.createContext<SelectContextValue>({
  variant: "default",
});

function SelectRoot({ variant = "default", children, ...props }: SelectProps) {
  const contextValue = React.useMemo(() => ({ variant }), [variant]);

  return (
    <SelectContext.Provider value={contextValue}>
      <SelectPrimitive.Root data-slot="select" {...props}>
        {children}
      </SelectPrimitive.Root>
    </SelectContext.Provider>
  );
}

function SelectGroup({ className, ...props }: SelectGroupProps) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  );
}

function SelectValue({ ...props }: SelectValueProps) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = "default",
  variant: customVariant,
  children,
  ...props
}: SelectTriggerProps) {
  const context = React.useContext(SelectContext);
  const variant = customVariant ?? context.variant;

  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      data-variant={variant}
      className={cn(selectTriggerVariants({ variant, size, className }))}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ArrowDownIcon className="pointer-events-none size-4 opacity-70" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = "item-aligned",
  align = "center",
  variant: customVariant,
  ...props
}: SelectContentProps) {
  const context = React.useContext(SelectContext);
  const variant = customVariant ?? context.variant;

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        data-variant={variant}
        data-align-trigger={position === "item-aligned"}
        className={cn(
          selectContentVariants({ variant }),
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className,
        )}
        position={position}
        align={align}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          data-position={position}
          className={cn(
            "data-[position=popper]:h-(--radix-select-trigger-height) data-[position=popper]:w-full data-[position=popper]:min-w-(--radix-select-trigger-width)",
            position === "popper" && "",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: SelectLabelProps) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("px-1.5 py-1 text-xs opacity-70", className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  variant: customVariant,
  children,
  ...props
}: SelectItemProps) {
  const context = React.useContext(SelectContext);
  const variant = customVariant ?? context.variant;

  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      data-variant={variant}
      className={cn(selectItemVariants({ variant, className }))}
      {...props}
    >
      <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="pointer-events-none" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: SelectSeparatorProps) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn(
        "pointer-events-none -mx-1 my-1 h-px bg-border/50",
        className,
      )}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: SelectScrollUpButtonProps) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "z-10 flex cursor-default items-center justify-center bg-inherit py-1 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <ArrowUpIcon />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: SelectScrollDownButtonProps) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "z-10 flex cursor-default items-center justify-center bg-inherit py-1 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <ArrowDownIcon />
    </SelectPrimitive.ScrollDownButton>
  );
}

export const Select = Object.assign(SelectRoot, {
  Group: SelectGroup,
  Value: SelectValue,
  Trigger: SelectTrigger,
  Content: SelectContent,
  Label: SelectLabel,
  Item: SelectItem,
  Separator: SelectSeparator,
  ScrollUpButton: SelectScrollUpButton,
  ScrollDownButton: SelectScrollDownButton,
});
