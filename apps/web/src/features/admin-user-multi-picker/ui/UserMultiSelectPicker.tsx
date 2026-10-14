"use client";

import { SearchIcon } from "@packages/icons";
import { Field, Input, Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";
import { useUserMultiSelectPicker } from "../model/useUserMultiSelectPicker";
import type { PickerUser } from "../model/useUserSearch";
import { SelectedUserChip } from "./SelectedUserChip";
import { UserBulkInput } from "./UserBulkInput";
import { UserSearchResults } from "./UserSearchResults";

export interface UserMultiSelectPickerProps {
  value: PickerUser[];
  onChange: (value: PickerUser[]) => void;
  disabled?: boolean;
  error?: string;
  label?: string;
  placeholder?: string;
  className?: string;
  maxSelected?: number;
  showBulkInput?: boolean;
  hideLabel?: boolean;
  hideSelectedCount?: boolean;
}

export function UserMultiSelectPicker({
  value,
  onChange,
  disabled = false,
  error,
  label,
  placeholder,
  className,
  maxSelected = 1000,
  showBulkInput = true,
  hideLabel = false,
  hideSelectedCount = false,
}: UserMultiSelectPickerProps) {
  const { t } = useTranslation("common");
  const picker = useUserMultiSelectPicker({
    value,
    onChange,
    disabled,
    maxSelected,
    t,
  });
  const accessibleLabel =
    label ??
    t("adminUserPicker.label", { defaultValue: "adminUserPicker.label" });

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {value.map((user) => (
          <SelectedUserChip
            key={user.id}
            user={user}
            onRemove={picker.removeUser}
            disabled={disabled}
          />
        ))}
      </div>
      <div className={hideLabel ? "relative" : "relative mt-2"}>
        <Field className="relative" invalid={Boolean(error)}>
          <Field.Label
            className={hideLabel ? "sr-only" : "mb-2 block text-sm font-medium"}
          >
            {accessibleLabel}
          </Field.Label>
          <SearchIcon
            aria-hidden="true"
            className={`pointer-events-none absolute left-3 ${hideLabel ? "top-1/2" : "top-[3.05rem]"} size-4 -translate-y-1/2 text-muted-foreground`}
          />
          <Field.Content>
            <Input
              ref={picker.inputRef}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={picker.isOpen}
              aria-controls={picker.listboxId}
              aria-activedescendant={
                picker.isOpen && picker.availableResults[picker.activeIndex]
                  ? picker.listboxId +
                    "-" +
                    picker.availableResults[picker.activeIndex].id
                  : undefined
              }
              aria-invalid={Boolean(error)}
              aria-describedby={error ? picker.errorId : undefined}
              aria-label={accessibleLabel}
              placeholder={
                placeholder ??
                t("adminUserPicker.searchPlaceholder", {
                  defaultValue: "adminUserPicker.searchPlaceholder",
                })
              }
              value={picker.search}
              disabled={disabled}
              className="pl-9"
              onFocus={() => picker.setIsOpen(true)}
              onChange={picker.handleSearchChange}
              onKeyDown={picker.handleSearchKeyDown}
              onBlur={picker.handleSearchBlur}
            />
          </Field.Content>
          {error && <Field.Error id={picker.errorId}>{error}</Field.Error>}
        </Field>
        {picker.isOpen && !disabled && (
          <div
            id={picker.listboxId}
            role="listbox"
            aria-label={t("adminUserPicker.results", {
              defaultValue: "adminUserPicker.results",
            })}
            className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          >
            <UserSearchResults
              listboxId={picker.listboxId}
              isLoading={picker.isLoading}
              isError={picker.isError}
              search={picker.search}
              activeIndex={picker.activeIndex}
              availableResults={picker.availableResults}
              onSelect={picker.addUser}
              t={t}
            />
          </div>
        )}
      </div>
      {!hideSelectedCount && (
        <Typography.P className="mt-2 text-sm text-muted-foreground">
          {t("adminUserPicker.selectedCount", {
            count: value.length,
            defaultValue: "adminUserPicker.selectedCount",
          })}
        </Typography.P>
      )}
      {showBulkInput && (
        <UserBulkInput
          value={picker.bulkText}
          error={picker.bulkError}
          disabled={disabled || value.length >= maxSelected}
          isResolving={picker.isResolving}
          onChange={picker.setBulkText}
          onAdd={() => void picker.handleBulkAdd()}
          onDismissError={() => picker.setBulkError(null)}
          t={t}
        />
      )}
    </div>
  );
}
