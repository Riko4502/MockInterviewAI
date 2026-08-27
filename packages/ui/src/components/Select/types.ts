import type * as React from "react"
import type { Select as SelectPrimitive } from "radix-ui"
import type { VariantProps } from "class-variance-authority"
import type {
  selectTriggerVariants,
  selectContentVariants,
  selectItemVariants,
} from "./constants"

export type SelectVariant = "default" | "primary" | "secondary"

export interface SelectContextValue {
  variant: SelectVariant
}

export type SelectProps = React.ComponentProps<typeof SelectPrimitive.Root> & {
  variant?: SelectVariant
}

export type SelectGroupProps = React.ComponentProps<
  typeof SelectPrimitive.Group
>

export type SelectValueProps = React.ComponentProps<
  typeof SelectPrimitive.Value
>

export type SelectTriggerProps = React.ComponentProps<
  typeof SelectPrimitive.Trigger
> &
  VariantProps<typeof selectTriggerVariants>

export type SelectContentProps = React.ComponentProps<
  typeof SelectPrimitive.Content
> &
  VariantProps<typeof selectContentVariants>

export type SelectLabelProps = React.ComponentProps<
  typeof SelectPrimitive.Label
>

export type SelectItemProps = React.ComponentProps<
  typeof SelectPrimitive.Item
> &
  VariantProps<typeof selectItemVariants>

export type SelectSeparatorProps = React.ComponentProps<
  typeof SelectPrimitive.Separator
>

export type SelectScrollUpButtonProps = React.ComponentProps<
  typeof SelectPrimitive.ScrollUpButton
>

export type SelectScrollDownButtonProps = React.ComponentProps<
  typeof SelectPrimitive.ScrollDownButton
>
