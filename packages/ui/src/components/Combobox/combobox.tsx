"use client";

import { ArrowDownIcon, CheckIcon, SearchIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import { Popover as PopoverPrimitive } from "radix-ui";
import * as React from "react";
import { Input } from "../Input";
import { COMBOBOX_STYLES } from "./constants";
import type { ComboboxGroup, ComboboxOption, ComboboxProps } from "./types";

const DEFAULT_FILTER = (option: ComboboxOption, query: string): boolean => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [option.label, option.value, ...(option.keywords ?? [])]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
};

function toGroups(
  options: readonly ComboboxOption[] | undefined,
  groups: readonly ComboboxGroup[] | undefined,
): ComboboxGroup[] {
  if (groups && groups.length > 0) {
    return groups.map((group) => ({
      ...group,
      key: group.key ?? String(group.label),
      options: [...group.options],
    }));
  }
  if (options && options.length > 0) {
    return [{ key: "all", label: null, options: [...options] }];
  }
  return [];
}

/**
 * Combobox — доступный селектор с поиском и группировкой опций.
 *
 * Построен на базе `radix-ui` Popover. Триггер открывает панель с полем поиска
 * и списком `role="listbox"`; навигация — клавиатурой (↑/↓/Enter), фильтрация —
 * по подстроке в `label`/`value`/`keywords` (можно переопределить через `filter`).
 */
export function Combobox({
  value,
  onValueChange,
  options,
  groups,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  className,
  contentClassName,
  id,
  name,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  filter,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listboxRef = React.useRef<HTMLDivElement | null>(null);
  const baseId = React.useId();
  const listboxId = `${baseId}-listbox`;

  const allGroups = React.useMemo(
    () => toGroups(options, groups),
    [options, groups],
  );

  const filterFn = filter ?? DEFAULT_FILTER;

  const filteredGroups = React.useMemo(
    () =>
      allGroups
        .map((group) => ({
          ...group,
          options: group.options.filter((option) => filterFn(option, query)),
        }))
        .filter((group) => group.options.length > 0),
    [allGroups, query, filterFn],
  );

  const flatOptions = React.useMemo(() => {
    const items: ComboboxOption[] = [];
    for (const group of filteredGroups) {
      items.push(...group.options);
    }
    return items;
  }, [filteredGroups]);

  const selectedLabel = React.useMemo(() => {
    for (const group of allGroups) {
      const match = group.options.find((option) => option.value === value);
      if (match) return match.label;
    }
    return undefined;
  }, [allGroups, value]);

  React.useEffect(() => {
    if (!open) return;
    const firstEnabled = flatOptions.findIndex((option) => !option.disabled);
    setActiveIndex(firstEnabled);
  }, [open, flatOptions]);

  React.useEffect(() => {
    if (!open || activeIndex < 0) return;
    const node = listboxRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    node?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  };

  const moveActive = (direction: 1 | -1) => {
    if (flatOptions.length === 0) return;
    setActiveIndex((prev) => {
      let index = prev;
      for (let step = 0; step < flatOptions.length; step += 1) {
        index = (index + direction + flatOptions.length) % flatOptions.length;
        if (!flatOptions[index].disabled) return index;
      }
      return prev;
    });
  };

  const selectOption = (option: ComboboxOption) => {
    if (option.disabled) return;
    onValueChange?.(option.value);
    setOpen(false);
    setQuery("");
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Enter") {
      const item = flatOptions[activeIndex];
      if (item) {
        event.preventDefault();
        selectOption(item);
      }
    } else if (event.key === "Escape") {
      handleOpenChange(false);
    }
  };

  const activeDescendant =
    open && activeIndex >= 0 ? `${baseId}-opt-${activeIndex}` : undefined;

  let optionIndex = -1;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          name={name}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          disabled={disabled}
          data-slot="combobox-trigger"
          className={cn(
            COMBOBOX_STYLES.trigger,
            !selectedLabel && COMBOBOX_STYLES.triggerPlaceholder,
            className,
          )}
        >
          <span className={COMBOBOX_STYLES.triggerValue}>
            {selectedLabel ?? placeholder}
          </span>
          <ArrowDownIcon className={COMBOBOX_STYLES.icon} />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-slot="combobox-content"
          align="start"
          sideOffset={4}
          className={cn(COMBOBOX_STYLES.content, contentClassName)}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <div className={COMBOBOX_STYLES.searchWrapper}>
            <SearchIcon />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              aria-controls={listboxId}
              aria-activedescendant={activeDescendant}
              aria-autocomplete="list"
              autoComplete="off"
              spellCheck={false}
              className={COMBOBOX_STYLES.searchInput}
            />
          </div>

          <div
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel ?? searchPlaceholder}
            className={COMBOBOX_STYLES.listbox}
          >
            {flatOptions.length === 0 ? (
              <div className={COMBOBOX_STYLES.empty}>{emptyText}</div>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.key} role="presentation">
                  {group.label ? (
                    <div
                      role="presentation"
                      className={COMBOBOX_STYLES.groupLabel}
                    >
                      {group.label}
                    </div>
                  ) : null}
                  {group.options.map((option) => {
                    optionIndex += 1;
                    const index = optionIndex;
                    const isSelected = option.value === value;
                    const isActive = index === activeIndex;
                    return (
                      <button
                        type="button"
                        key={option.value}
                        id={`${baseId}-opt-${index}`}
                        role="option"
                        tabIndex={-1}
                        aria-selected={isSelected}
                        aria-disabled={option.disabled || undefined}
                        data-index={index}
                        data-active={isActive}
                        data-disabled={option.disabled || undefined}
                        className={COMBOBOX_STYLES.option}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseMove={() => {
                          if (!option.disabled) setActiveIndex(index);
                        }}
                        onClick={() => selectOption(option)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            selectOption(option);
                          }
                        }}
                      >
                        <span className="truncate">{option.label}</span>
                        {isSelected ? (
                          <CheckIcon className={COMBOBOX_STYLES.optionCheck} />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
