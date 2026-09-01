"use client";

import { ArrowDownIcon, ArrowUpIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import * as React from "react";
import { inputVariants } from "./constants";
import type { InputProps } from "./types";

/**
 * Базовый компонент поля ввода (Input).
 *
 * Особенности:
 * - Поддержка всех стандартных HTML-типов (`text`, `password`, `email`, `number` и т.д.);
 * - При `type="number"` автоматически блокирует ввод нечисловых символов;
 * - Для `type="number"` отображает стильные кастомные кнопки регулирования значения (stepper);
 * - Полная поддержка `ref`, состояний валидации (`aria-invalid`) и блокировки (`disabled`).
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      showStepper = true,
      min,
      max,
      step,
      disabled,
      readOnly,
      onKeyDown,
      onPaste,
      ...props
    },
    ref,
  ) => {
    const internalRef = React.useRef<HTMLInputElement | null>(null);

    // Объединяем внешний и внутренний ref
    React.useImperativeHandle(
      ref,
      () => internalRef.current as HTMLInputElement,
    );

    const isNumber = type === "number";

    // Ограничение ввода только числовыми символами
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (isNumber) {
        // Разрешаем горячие клавиши и клавиши навигации
        if (
          e.ctrlKey ||
          e.metaKey ||
          [
            "Backspace",
            "Delete",
            "Tab",
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
            "Enter",
            "Escape",
            "Home",
            "End",
          ].includes(e.key)
        ) {
          onKeyDown?.(e);
          return;
        }

        // Разрешаем цифры, знак минуса и десятичную точку
        const isDigit = /^[0-9]$/.test(e.key);
        const isMinus = e.key === "-" && (!min || Number(min) < 0);
        const isDot =
          (e.key === "." || e.key === ",") &&
          (step === undefined || String(step).includes("."));

        if (!isDigit && !isMinus && !isDot) {
          e.preventDefault();
          return;
        }
      }
      onKeyDown?.(e);
    };

    // Защита от вставки нечислового содержимого
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      if (isNumber) {
        const text = e.clipboardData.getData("text");
        if (!/^-?\d*(\.\d+)?$/.test(text)) {
          e.preventDefault();
          return;
        }
      }
      onPaste?.(e);
    };

    // Управление значением через кастомные стрелки (stepper)
    const handleStep = (direction: "up" | "down") => {
      const input = internalRef.current;
      if (!input || disabled || readOnly) return;

      const currentVal = input.value === "" ? 0 : Number(input.value);
      const stepVal = step ? Number(step) : 1;
      const nextVal =
        direction === "up" ? currentVal + stepVal : currentVal - stepVal;

      const minVal = min !== undefined ? Number(min) : -Infinity;
      const maxVal = max !== undefined ? Number(max) : Infinity;

      const clampedVal = Math.min(Math.max(nextVal, minVal), maxVal);

      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, String(clampedVal));
      } else {
        input.value = String(clampedVal);
      }

      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const inputElement = (
      <input
        ref={internalRef}
        type={type}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        readOnly={readOnly}
        data-slot="input"
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={cn(
          inputVariants(),
          isNumber && showStepper && "pr-8",
          className,
        )}
        {...props}
      />
    );

    if (isNumber && showStepper) {
      return (
        <div className="relative flex items-center w-full group/number-input">
          {inputElement}
          <div className="absolute right-1.5 flex flex-col justify-center h-[34px] w-5 rounded overflow-hidden select-none">
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled || readOnly}
              aria-label="Увеличить значение"
              onClick={() => handleStep("up")}
              className="flex h-4 w-full items-center justify-center text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/80 active:bg-muted disabled:opacity-30 disabled:pointer-events-none rounded-t"
            >
              <ArrowUpIcon size="xs" className="size-2.5" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled || readOnly}
              aria-label="Уменьшить значение"
              onClick={() => handleStep("down")}
              className="flex h-4 w-full items-center justify-center text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/80 active:bg-muted disabled:opacity-30 disabled:pointer-events-none rounded-b"
            >
              <ArrowDownIcon size="xs" className="size-2.5" />
            </button>
          </div>
        </div>
      );
    }

    return inputElement;
  },
);

Input.displayName = "Input";

export { Input, inputVariants };
