"use client";

import { cn } from "@packages/utils";
import { Slider as SliderPrimitive } from "radix-ui";
import * as React from "react";
import { SLIDER_STYLES } from "./constants";
import type { SliderProps } from "./types";

/**
 * Компонент слайдера (Slider) в стиле shadcn/ui на базе radix-ui.
 */
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderProps) {
  const currentValues = React.useMemo(() => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(defaultValue)) return defaultValue;
    return [
      typeof value === "number"
        ? value
        : typeof defaultValue === "number"
          ? defaultValue
          : min,
    ];
  }, [value, defaultValue, min]);

  const thumbs = React.useMemo(
    () => currentValues.map((_, i) => ({ key: `thumb-${i}` })),
    [currentValues.map],
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(SLIDER_STYLES.root, className)}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={SLIDER_STYLES.track}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={SLIDER_STYLES.range}
        />
      </SliderPrimitive.Track>
      {thumbs.map((thumb) => (
        <SliderPrimitive.Thumb
          key={thumb.key}
          data-slot="slider-thumb"
          className={SLIDER_STYLES.thumb}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
