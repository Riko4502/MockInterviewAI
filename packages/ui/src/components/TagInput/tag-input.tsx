"use client";

import { CloseIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import {
  type ClipboardEvent,
  forwardRef,
  type KeyboardEvent,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  TAG_INPUT_STYLES,
  tagBadgeVariants,
  tagInputContainerVariants,
} from "./constants";
import type { TagInputProps } from "./types";

/**
 * Интерактивный компонент для ввода и управления массивом тегов / навыков.
 *
 * Поддерживает:
 * - Добавление по разделителям (`delimiters`, по умолчанию `Enter` и `,`)
 * - Вставку из буфера обмена со сплитом по запятой/переносу строки (`addOnPaste`)
 * - Добавление при потере фокуса (`addOnBlur`)
 * - Удаление последнего тега по `Backspace` в пустом поле
 * - Очистку всех тегов (`clearable` / `onClear`)
 * - Кастомный рендер (`renderTag`), префиксы/суффиксы (`prefix`, `suffix`, `showCount`)
 * - Ограничения `maxTags`, `minTagLength`, `maxTagLength`, `allowDuplicates`
 */
export const TagInput = forwardRef<HTMLInputElement, TagInputProps>(
  (
    {
      value,
      onChange,
      onTagAdd,
      onTagRemove,
      onClear,
      defaultValue = [],
      placeholder = "Добавьте тег и нажмите Enter...",
      maxTags,
      minTagLength = 1,
      maxTagLength,
      allowDuplicates = false,
      addOnBlur = true,
      addOnPaste = true,
      delimiters = [",", "Enter"],
      size = "md",
      tagVariant = "secondary",
      clearable = false,
      showCount = false,
      invalid = false,
      disabled = false,
      prefix,
      suffix,
      renderTag,
      className,
      onKeyDown,
      onPaste,
      ...props
    },
    ref,
  ) => {
    const isControlled = value !== undefined;
    const [internalTags, setInternalTags] = useState<string[]>(defaultValue);
    const [inputValue, setInputValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const tags = isControlled ? (value ?? []) : internalTags;

    const updateTags = (nextTags: string[]) => {
      if (!isControlled) {
        setInternalTags(nextTags);
      }
      onChange?.(nextTags);
    };

    const isMaxReached = maxTags !== undefined && tags.length >= maxTags;

    const handleAddSingleTag = (rawText: string): boolean => {
      const trimmed = rawText.trim();
      if (!trimmed) return false;

      if (minTagLength && trimmed.length < minTagLength) return false;
      if (maxTagLength && trimmed.length > maxTagLength) return false;
      if (maxTags && tags.length >= maxTags) return false;
      if (!allowDuplicates && tags.includes(trimmed)) return false;

      const nextTags = [...tags, trimmed];
      updateTags(nextTags);
      onTagAdd?.(trimmed);
      return true;
    };

    const handleAddMultipleTags = (rawList: string[]) => {
      let currentTags = [...tags];
      for (const item of rawList) {
        const trimmed = item.trim();
        if (!trimmed) continue;
        if (minTagLength && trimmed.length < minTagLength) continue;
        if (maxTagLength && trimmed.length > maxTagLength) continue;
        if (maxTags && currentTags.length >= maxTags) break;
        if (!allowDuplicates && currentTags.includes(trimmed)) continue;

        currentTags = [...currentTags, trimmed];
        onTagAdd?.(trimmed);
      }
      updateTags(currentTags);
      setInputValue("");
    };

    const handleRemoveTag = (indexToRemove: number) => {
      if (disabled) return;
      const tagToRemove = tags[indexToRemove];
      const nextTags = tags.filter((_, idx) => idx !== indexToRemove);
      updateTags(nextTags);
      onTagRemove?.(tagToRemove, indexToRemove);
    };

    const handleClearAll = () => {
      if (disabled) return;
      updateTags([]);
      setInputValue("");
      onClear?.();
      inputRef.current?.focus();
    };

    const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;

      const isDelimiter =
        delimiters.includes(e.key) ||
        (e.key === "Enter" && delimiters.includes("Enter"));

      if (isDelimiter) {
        e.preventDefault();
        if (!isMaxReached && inputValue.trim()) {
          const success = handleAddSingleTag(inputValue);
          if (success) {
            setInputValue("");
          }
        }
      } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
        e.preventDefault();
        handleRemoveTag(tags.length - 1);
      }
    };

    const handleInputPaste = (e: ClipboardEvent<HTMLInputElement>) => {
      onPaste?.(e);
      if (e.defaultPrevented || !addOnPaste) return;

      const pasteData = e.clipboardData.getData("text");
      if (
        pasteData.includes(",") ||
        pasteData.includes("\n") ||
        pasteData.includes(";")
      ) {
        e.preventDefault();
        const splitItems = pasteData
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        handleAddMultipleTags(splitItems);
      }
    };

    return (
      <div
        data-slot="tag-input"
        data-invalid={invalid}
        aria-invalid={invalid}
        className={cn(
          tagInputContainerVariants({ size }),
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            inputRef.current?.focus();
          }
        }}
      >
        {prefix && (
          <span className="inline-flex items-center text-muted-foreground mr-0.5">
            {prefix}
          </span>
        )}

        {tags.map((tag, index) => {
          if (renderTag) {
            return renderTag(tag, index, () => handleRemoveTag(index));
          }

          return (
            <span
              key={tag}
              data-slot="tag-item"
              className={tagBadgeVariants({ variant: tagVariant, size })}
            >
              <span>{tag}</span>
              {!disabled && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Удалить тег ${tag}`}
                  className={TAG_INPUT_STYLES.tagRemoveButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTag(index);
                  }}
                >
                  <CloseIcon size="xs" />
                </button>
              )}
            </span>
          );
        })}

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            if (isMaxReached && e.target.value.length > inputValue.length) {
              return;
            }
            setInputValue(e.target.value);
          }}
          onKeyDown={handleInputKeyDown}
          onPaste={handleInputPaste}
          onBlur={() => {
            if (addOnBlur && inputValue.trim() && !isMaxReached) {
              const success = handleAddSingleTag(inputValue);
              if (success) {
                setInputValue("");
              }
            }
          }}
          disabled={disabled}
          readOnly={isMaxReached}
          placeholder={
            isMaxReached
              ? `Лимит (${maxTags}) достигнут`
              : tags.length === 0
                ? placeholder
                : ""
          }
          className={cn(
            TAG_INPUT_STYLES.input,
            isMaxReached &&
              "cursor-not-allowed placeholder:text-muted-foreground/70",
          )}
          {...props}
        />

        {showCount && maxTags !== undefined && (
          <span className={TAG_INPUT_STYLES.countBadge}>
            {tags.length}/{maxTags}
          </span>
        )}

        {clearable && tags.length > 0 && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Очистить все теги"
            className={TAG_INPUT_STYLES.clearButton}
            onClick={handleClearAll}
          >
            <CloseIcon size="sm" />
          </button>
        )}

        {suffix && (
          <span className="inline-flex items-center text-muted-foreground ml-auto">
            {suffix}
          </span>
        )}
      </div>
    );
  },
);

TagInput.displayName = "TagInput";
