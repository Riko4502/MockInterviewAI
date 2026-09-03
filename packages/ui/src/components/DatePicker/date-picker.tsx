"use client";

import { CloseIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import { Popover as PopoverPrimitive } from "radix-ui";
import * as React from "react";
import { Calendar } from "./calendar";
import { DATE_PICKER_STYLES, formatDateRu } from "./constants";
import type { DatePickerProps } from "./types";

/**
 * Выпадающий компонент выбора даты (DatePicker).
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Выберите дату",
  disabled = false,
  minDate,
  maxDate,
  disabledDate,
  formatDate = formatDateRu,
  clearable = true,
  className,
  triggerClassName,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const displayValue = value ? formatDate(value) : "";

  const handleSelect = (date: Date) => {
    onChange?.(date);
    setOpen(false);
  };

  const handleClear = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    onChange?.(null);
  };

  return (
    <div
      data-slot="date-picker-wrapper"
      className={cn("relative w-full", className)}
    >
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            data-slot="date-picker-trigger"
            aria-expanded={open}
            className={cn(
              DATE_PICKER_STYLES.trigger,
              !value && "text-muted-foreground",
              triggerClassName,
            )}
          >
            <span className="truncate">{displayValue || placeholder}</span>

            <div className="flex items-center gap-1.5 ml-2 shrink-0">
              {clearable && value && !disabled ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleClear}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleClear(e);
                    }
                  }}
                  aria-label="Очистить дату"
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <CloseIcon size="xs" />
                </span>
              ) : (
                <svg
                  className="size-4 text-muted-foreground"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
              )}
            </div>
          </button>
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            data-slot="date-picker-popover"
            align="start"
            sideOffset={4}
            className={DATE_PICKER_STYLES.popover}
          >
            <Calendar
              selected={value}
              onSelect={handleSelect}
              defaultMonth={value || undefined}
              minDate={minDate}
              maxDate={maxDate}
              disabledDate={disabledDate}
            />
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}

// Прикрепляем календарь как подкомпонент
DatePicker.Calendar = Calendar;
