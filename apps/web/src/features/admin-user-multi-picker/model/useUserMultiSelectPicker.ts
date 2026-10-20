import type { TFunction } from "i18next";
import type { ChangeEvent, FocusEvent, KeyboardEvent } from "react";
import { useId, useRef, useState } from "react";
import { type PickerUser, useUserSearch } from "./useUserSearch";

type Options = {
  value: PickerUser[];
  onChange: (value: PickerUser[]) => void;
  disabled: boolean;
  maxSelected: number;
  t: TFunction<"common">;
};

export function useUserMultiSelectPicker({
  value,
  onChange,
  disabled,
  maxSelected,
  t,
}: Options) {
  const inputId = useId();
  const listboxId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const { results, isLoading, isError, resolveIdentifiers } = useUserSearch(
    search,
    isOpen && !disabled,
  );
  const selectedIds = new Set(value.map((user) => user.id));
  const availableResults = results.filter((user) => !selectedIds.has(user.id));

  const addUser = (user: PickerUser) => {
    if (disabled || selectedIds.has(user.id) || value.length >= maxSelected)
      return;
    onChange([...value, user]);
    setSearch("");
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  const removeUser = (user: PickerUser) => {
    if (!disabled)
      onChange(value.filter((selected) => selected.id !== user.id));
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) =>
        availableResults.length === 0
          ? 0
          : (index + 1) % availableResults.length,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        availableResults.length === 0
          ? 0
          : (index - 1 + availableResults.length) % availableResults.length,
      );
    } else if (
      event.key === "Enter" &&
      isOpen &&
      availableResults[activeIndex]
    ) {
      event.preventDefault();
      addUser(availableResults[activeIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
    } else if (
      event.key === "Backspace" &&
      search.length === 0 &&
      value.length > 0
    ) {
      removeUser(value[value.length - 1]);
    }
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setIsOpen(true);
    setActiveIndex(0);
  };

  const handleSearchBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (
      !event.currentTarget.parentElement?.parentElement?.contains(
        event.relatedTarget,
      )
    ) {
      setIsOpen(false);
    }
  };

  const handleBulkAdd = async () => {
    const identifiers = Array.from(
      new Set(
        bulkText
          .split(/[\s,]+/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
    if (identifiers.length === 0) return;

    setIsResolving(true);
    setBulkError(null);
    try {
      const result = await resolveIdentifiers(identifiers);
      const existingIds = new Set(value.map((user) => user.id));
      const additions = result.users
        .filter((user) => !existingIds.has(user.id))
        .slice(0, Math.max(0, maxSelected - value.length));
      if (additions.length > 0) onChange([...value, ...additions]);
      setBulkText("");
      if (result.unresolved.length > 0) {
        setBulkError(
          t("adminUserPicker.bulkUnresolved", {
            count: result.unresolved.length,
            defaultValue: "adminUserPicker.bulkUnresolved",
          }),
        );
      }
    } finally {
      setIsResolving(false);
    }
  };

  return {
    inputId,
    listboxId,
    errorId,
    inputRef,
    search,
    setSearch,
    isOpen,
    setIsOpen,
    activeIndex,
    bulkText,
    setBulkText,
    bulkError,
    setBulkError,
    isResolving,
    isLoading,
    isError,
    availableResults,
    addUser,
    removeUser,
    handleSearchKeyDown,
    handleSearchChange,
    handleSearchBlur,
    handleBulkAdd,
  };
}
