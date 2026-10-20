"use client";

import { CloseIcon } from "@packages/icons";
import { Avatar, Button } from "@packages/ui";
import { useTranslation } from "react-i18next";
import type { PickerUser } from "../model/useUserSearch";

export interface SelectedUserChipProps {
  user: PickerUser;
  onRemove: (user: PickerUser) => void;
  disabled?: boolean;
}

export function SelectedUserChip({
  user,
  onRemove,
  disabled = false,
}: SelectedUserChipProps) {
  const { t } = useTranslation("common");
  const name = user.displayName || user.username || user.email;

  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2">
      <Avatar size="sm" aria-hidden="true">
        {user.avatarUrl ? <Avatar.Image src={user.avatarUrl} alt="" /> : null}
        <Avatar.Fallback>
          {name.slice(0, 1).toLocaleUpperCase()}
        </Avatar.Fallback>
      </Avatar>
      <span className="min-w-0 truncate text-sm" title={user.email}>
        {name}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={disabled}
        aria-label={t("adminUserPicker.removeUser", {
          name,
          defaultValue: "adminUserPicker.removeUser",
        })}
        onClick={() => onRemove(user)}
      >
        <CloseIcon aria-hidden="true" />
      </Button>
    </span>
  );
}
