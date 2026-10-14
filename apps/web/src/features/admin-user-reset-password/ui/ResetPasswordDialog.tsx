"use client";

import {
  getAdminUsersControllerGetUserByIdQueryKey,
  useAdminUsersControllerResetPassword,
} from "@packages/api";
import { Button, Dialog, useToast } from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminUser } from "@/entities/admin-user";

export interface ResetPasswordDialogProps {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
}: ResetPasswordDialogProps) {
  const { t } = useTranslation("common");
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetPasswordMutation = useAdminUsersControllerResetPassword();

  if (!user) return null;

  const handleClose = (nextOpen: boolean) => {
    if (isSubmitting) return;
    onOpenChange(nextOpen);
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await resetPasswordMutation.mutateAsync({ id: user.id });

      toast.push({
        status: "success",
        title: t("admin.users.resetPasswordModal.successToast"),
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["/api/v1/admin/users"],
        }),
        queryClient.invalidateQueries({
          queryKey: getAdminUsersControllerGetUserByIdQueryKey(user.id),
        }),
      ]);

      handleClose(false);
    } catch {
      toast.push({
        status: "error",
        title: t("admin.users.resetPasswordModal.title"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <Dialog.Content className="sm:max-w-[460px]">
        <Dialog.Header>
          <Dialog.Title>
            {t("admin.users.resetPasswordModal.title")}
          </Dialog.Title>
          <Dialog.Description>
            {t("admin.users.resetPasswordModal.description", {
              email: user.email,
            })}
          </Dialog.Description>
        </Dialog.Header>

        <Dialog.Footer className="pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isSubmitting}
          >
            {t("common.cancel", "Отмена")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isSubmitting}
            data-testid="reset-password-confirm-btn"
          >
            {isSubmitting
              ? t("common.loading", "Загрузка...")
              : t("admin.users.resetPasswordModal.confirm")}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
