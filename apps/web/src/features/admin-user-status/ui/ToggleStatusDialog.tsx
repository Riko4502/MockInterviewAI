"use client";

import {
  getAdminUsersControllerGetUserByIdQueryKey,
  useAdminUsersControllerUpdateStatus,
} from "@packages/api";
import { Button, Dialog, useToast } from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminUser } from "@/entities/admin-user";
import { useSession } from "@/entities/session";

export interface ToggleStatusDialogProps {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ToggleStatusDialog({
  user,
  open,
  onOpenChange,
}: ToggleStatusDialogProps) {
  const { t } = useTranslation("common");
  const toast = useToast();
  const queryClient = useQueryClient();
  const session = useSession({ optional: true });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateStatusMutation = useAdminUsersControllerUpdateStatus();

  if (!user) return null;

  const isSelf = Boolean(session?.userId && session.userId === user.id);
  const isDeactivating = user.isActive;
  const isBlocked = isSelf && isDeactivating;

  const handleClose = (nextOpen: boolean) => {
    if (isSubmitting) return;
    onOpenChange(nextOpen);
  };

  const handleConfirm = async () => {
    if (isBlocked) return;
    setIsSubmitting(true);
    try {
      const nextActive = !user.isActive;
      await updateStatusMutation.mutateAsync({
        id: user.id,
        data: { isActive: nextActive },
      });

      toast.push({
        status: "success",
        title: nextActive
          ? t("admin.users.toggleStatusModal.successActivated")
          : t("admin.users.toggleStatusModal.successDeactivated"),
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
        title: isDeactivating
          ? t("admin.users.toggleStatusModal.deactivateTitle")
          : t("admin.users.toggleStatusModal.activateTitle"),
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
            {isDeactivating
              ? t("admin.users.toggleStatusModal.deactivateTitle")
              : t("admin.users.toggleStatusModal.activateTitle")}
          </Dialog.Title>
          <Dialog.Description>
            {isDeactivating
              ? t("admin.users.toggleStatusModal.deactivateDescription", {
                  email: user.email,
                })
              : t("admin.users.toggleStatusModal.activateDescription", {
                  email: user.email,
                })}
          </Dialog.Description>
        </Dialog.Header>

        {isBlocked && (
          <div
            className="p-3 my-2 text-xs text-destructive bg-destructive/10 rounded-md border border-destructive/20 font-medium"
            data-testid="self-deactivation-warning"
          >
            {t("admin.users.selfProtection.cannotDeactivateSelf")}
          </div>
        )}

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
            variant={isDeactivating ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isSubmitting || isBlocked}
            data-testid="toggle-status-confirm-btn"
          >
            {isSubmitting
              ? t("common.loading", "Загрузка...")
              : isDeactivating
                ? t("admin.users.toggleStatusModal.confirmDeactivate")
                : t("admin.users.toggleStatusModal.confirmActivate")}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
