import type { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

export type RadioGroupProps = ComponentProps<typeof RadioGroupPrimitive.Root>;
export type RadioGroupItemProps = ComponentProps<
  typeof RadioGroupPrimitive.Item
>;
