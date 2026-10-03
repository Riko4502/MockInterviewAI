"use client";

import { useProfileControllerDeleteMyProfile } from "@packages/api";
import { TrashIcon } from "@packages/icons";
import { Button, Dialog, Spin, useToast } from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "@/entities/session";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";

export function DeleteAccountSection() {
  const { t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession({ optional: true });
  const toast = useToast();

  const deleteMutation = useProfileControllerDeleteMyProfile();
  const isDeleting = deleteMutation.isPending;

  const handleDelete = () => {
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        session?.clearSession();
        queryClient.clear();
        setIsOpen(false);
        toast.push({
          status: "success",
          title: t("profile.deleteAccountSuccess"),
        });
        router.replace(paths.login);
      },
      onError: () => {
        toast.push({
          status: "error",
          title: t("profile.deleteAccountError"),
        });
      },
    });
  };

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-destructive">
            {t("profile.dangerZoneTitle")}
          </span>
          <p className="text-xs text-muted-foreground">
            {t("profile.dangerZoneDescription")}
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="shrink-0 self-start sm:self-auto"
          onClick={() => setIsOpen(true)}
        >
          <TrashIcon size="sm" aria-hidden="true" />
          {t("profile.deleteAccount")}
        </Button>
      </div>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => !isDeleting && setIsOpen(open)}
      >
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>
              {t("profile.deleteAccountConfirmTitle")}
            </Dialog.Title>
            <Dialog.Description>
              {t("profile.deleteAccountConfirmDescription")}
            </Dialog.Description>
          </Dialog.Header>

          <Dialog.Footer className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setIsOpen(false)}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              aria-busy={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? (
                <Spin size="sm" variant="current" aria-hidden="true" />
              ) : (
                <TrashIcon size="sm" aria-hidden="true" />
              )}
              {isDeleting
                ? t("profile.deleting")
                : t("profile.deleteAccountConfirmButton")}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </>
  );
}
