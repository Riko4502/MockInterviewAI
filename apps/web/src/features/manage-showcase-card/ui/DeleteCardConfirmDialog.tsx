"use client";

import { Button, Dialog } from "@packages/ui";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { useShowcaseMutations } from "../model/use-showcase-mutations";

export interface DeleteCardConfirmDialogProps {
  cardId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeleteCardConfirmDialog({
  cardId,
  open,
  onOpenChange,
  onSuccess,
}: DeleteCardConfirmDialogProps) {
  const { t } = useTranslation("showcase");
  const { deleteCard, isDeleting } = useShowcaseMutations();

  const handleDelete = async () => {
    if (!cardId) return;
    await deleteCard(cardId, {
      onSuccess: () => {
        onOpenChange(false);
        onSuccess?.();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="w-full sm:max-w-md max-w-md">
        <Dialog.Header>
          <Dialog.Title className="text-lg font-bold">
            {t("deleteDialog.title")}
          </Dialog.Title>
          <Dialog.Description className="text-xs text-muted-foreground mt-1">
            {t("deleteDialog.description")}
          </Dialog.Description>
        </Dialog.Header>

        <Dialog.Footer className="mt-4 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
          >
            {t("deleteDialog.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isDeleting}
            onClick={handleDelete}
          >
            {isDeleting ? t("actions.loading") : t("deleteDialog.confirm")}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
