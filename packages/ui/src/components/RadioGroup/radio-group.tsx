"use client";

import { cn } from "@packages/utils";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { RADIO_GROUP_STYLES } from "./constants";
import type { RadioGroupItemProps, RadioGroupProps } from "./types";

/**
 * Группа радио-кнопок (RadioGroup).
 *
 * Составной API: `RadioGroup` (корень) + `RadioGroup.Item`.
 * Построен на базе Radix UI RadioGroup с поддержкой клавиатурной навигации стрелками.
 */
function RadioGroupRoot({ className, ...props }: RadioGroupProps) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn(RADIO_GROUP_STYLES.root, className)}
      {...props}
    />
  );
}

function RadioGroupItem({ className, ...props }: RadioGroupItemProps) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(RADIO_GROUP_STYLES.item, className)}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className={RADIO_GROUP_STYLES.indicator}
      />
    </RadioGroupPrimitive.Item>
  );
}

export const RadioGroup = Object.assign(RadioGroupRoot, {
  Item: RadioGroupItem,
});
