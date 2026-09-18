"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  EyeOffIcon,
} from "@packages/icons";
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
 * - Для `type="password"` отображает кнопку переключения видимости пароля;
 * - Полная поддержка `ref`, состояний валидации (`aria-invalid`) и блокировки (`disabled`).
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      showStepper = true,
      showPasswordLabel = "Show password",
      hidePasswordLabel = "Hide password",
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
    const isPassword = type === "password";

    const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);

    const normalizedMin = React.useMemo(() => {
      if (
        min === undefined ||
        min === null ||
        (typeof min === "string" && min.trim() === "")
      ) {
        return undefined;
      }
      const num = Number(min);
      return Number.isNaN(num) ? undefined : num;
    }, [min]);

    const normalizedMax = React.useMemo(() => {
      if (
        max === undefined ||
        max === null ||
        (typeof max === "string" && max.trim() === "")
      ) {
        return undefined;
      }
      const num = Number(max);
      return Number.isNaN(num) ? undefined : num;
    }, [max]);

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
        const isMinus =
          e.key === "-" && (normalizedMin === undefined || normalizedMin < 0);
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
        const isMinusAllowed = normalizedMin === undefined || normalizedMin < 0;
        const numberRegex = isMinusAllowed
          ? /^-?\d*(\.\d+)?$/
          : /^\d*(\.\d+)?$/;

        if (!numberRegex.test(text)) {
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

      const minVal = normalizedMin !== undefined ? normalizedMin : -Infinity;
      const maxVal = normalizedMax !== undefined ? normalizedMax : Infinity;

      if (input.value === "") {
        if (direction === "down" && 0 <= minVal) {
          return;
        }
      } else {
        const currentNum = Number(input.value);
        if (direction === "down" && currentNum <= minVal) {
          return;
        }
        if (direction === "up" && currentNum >= maxVal) {
          return;
        }
      }

      const currentVal = input.value === "" ? 0 : Number(input.value);
      const stepVal = step ? Number(step) : 1;
      const nextVal =
        direction === "up" ? currentVal + stepVal : currentVal - stepVal;

      const clampedVal = Math.min(Math.max(nextVal, minVal), maxVal);

      if (input.value !== "" && clampedVal === Number(input.value)) {
        return;
      }

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
        type={isPassword ? (isPasswordVisible ? "text" : "password") : type}
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
          isPassword && "pr-10",
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

    if (isPassword) {
      return (
        <div className="relative">
          {inputElement}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsPasswordVisible((prev) => !prev)}
            aria-label={
              isPasswordVisible ? hidePasswordLabel : showPasswordLabel
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            {isPasswordVisible ? (
              <EyeOffIcon className="size-4" />
            ) : (
              <EyeIcon className="size-4" />
            )}
          </button>
        </div>
      );
    }

    return inputElement;
  },
);

Input.displayName = "Input";

export { Input, inputVariants };
