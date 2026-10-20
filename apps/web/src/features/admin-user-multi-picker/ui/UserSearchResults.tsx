import { Avatar, Button, Spin, Typography } from "@packages/ui";
import type { TFunction } from "i18next";
import type { PickerUser } from "../model/useUserSearch";

type Props = {
  listboxId: string;
  isLoading: boolean;
  isError: boolean;
  search: string;
  activeIndex: number;
  availableResults: PickerUser[];
  onSelect: (user: PickerUser) => void;
  t: TFunction<"common">;
};

export function UserSearchResults({
  listboxId,
  isLoading,
  isError,
  search,
  activeIndex,
  availableResults,
  onSelect,
  t,
}: Props) {
  if (isLoading) {
    return (
      <div
        aria-live="polite"
        className="flex items-center gap-2 p-3 text-sm text-muted-foreground"
      >
        <Spin />
        {t("adminUserPicker.loading", {
          defaultValue: "adminUserPicker.loading",
        })}
      </div>
    );
  }
  if (isError) {
    return (
      <Typography.P role="alert" className="p-3 text-sm text-destructive">
        {t("adminUserPicker.searchError", {
          defaultValue: "adminUserPicker.searchError",
        })}
      </Typography.P>
    );
  }
  if (!search.trim()) {
    return (
      <Typography.P className="p-3 text-sm text-muted-foreground">
        {t("adminUserPicker.startTyping", {
          defaultValue: "adminUserPicker.startTyping",
        })}
      </Typography.P>
    );
  }
  if (availableResults.length === 0) {
    return (
      <Typography.P
        aria-live="polite"
        className="p-3 text-sm text-muted-foreground"
      >
        {t("adminUserPicker.empty", { defaultValue: "adminUserPicker.empty" })}
      </Typography.P>
    );
  }

  return availableResults.map((user, index) => {
    const name = user.displayName || user.username || user.email;
    return (
      <Button
        key={user.id}
        id={`${listboxId}-${user.id}`}
        type="button"
        variant="ghost"
        role="option"
        aria-selected={index === activeIndex}
        className={
          "h-auto w-full justify-start gap-3 rounded-sm p-2 text-left " +
          (index === activeIndex ? "bg-accent" : "")
        }
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onSelect(user)}
      >
        <Avatar size="sm" aria-hidden="true">
          {user.avatarUrl ? <Avatar.Image src={user.avatarUrl} alt="" /> : null}
          <Avatar.Fallback>
            {name.slice(0, 1).toLocaleUpperCase()}
          </Avatar.Fallback>
        </Avatar>
        <span className="min-w-0 flex-1 text-left">
          <Typography as="span" className="block truncate text-sm font-medium">
            {name}
          </Typography>
          <Typography
            as="span"
            className="block truncate text-xs text-muted-foreground"
          >
            {user.email}
          </Typography>
        </span>
      </Button>
    );
  });
}
