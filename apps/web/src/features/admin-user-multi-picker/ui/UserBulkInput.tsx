import { CloseIcon } from "@packages/icons";
import { Button, Field, Textarea } from "@packages/ui";
import type { TFunction } from "i18next";

type Props = {
  value: string;
  error: string | null;
  disabled: boolean;
  isResolving: boolean;
  onChange: (value: string) => void;
  onAdd: () => void;
  onDismissError: () => void;
  t: TFunction<"common">;
};

export function UserBulkInput({
  value,
  error,
  disabled,
  isResolving,
  onChange,
  onAdd,
  onDismissError,
  t,
}: Props) {
  const label = t("adminUserPicker.bulkLabel", {
    defaultValue: "adminUserPicker.bulkLabel",
  });

  return (
    <Field className="mt-3 space-y-2" invalid={Boolean(error)}>
      <Field.Label>{label}</Field.Label>
      <Field.Content>
        <Textarea
          value={value}
          disabled={disabled || isResolving}
          aria-label={label}
          placeholder={t("adminUserPicker.bulkPlaceholder", {
            defaultValue: "adminUserPicker.bulkPlaceholder",
          })}
          onChange={(event) => onChange(event.target.value)}
        />
      </Field.Content>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || isResolving || value.trim().length === 0}
        onClick={onAdd}
      >
        {isResolving
          ? t("adminUserPicker.resolving", {
              defaultValue: "adminUserPicker.resolving",
            })
          : t("adminUserPicker.addUsers", {
              defaultValue: "adminUserPicker.addUsers",
            })}
      </Button>
      {error && (
        <div className="flex items-center justify-between gap-2">
          <Field.Error>{error}</Field.Error>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label={t("adminUserPicker.dismissError", {
              defaultValue: "adminUserPicker.dismissError",
            })}
            onClick={onDismissError}
          >
            <CloseIcon aria-hidden="true" />
          </Button>
        </div>
      )}
    </Field>
  );
}
