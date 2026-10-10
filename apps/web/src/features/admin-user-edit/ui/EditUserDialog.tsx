"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  getAdminUsersControllerGetUserByIdQueryKey,
  useAdminUsersControllerUpdateUser,
} from "@packages/api";
import {
  GIT_URL_REGEX,
  TELEGRAM_USERNAME_REGEX,
  type UpdateUserAdminDto,
  USERNAME_REGEX,
} from "@packages/dto";
import { SystemRole } from "@packages/types";
import { Button, Dialog, Input, Label, Select, useToast } from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import type { AdminUser } from "@/entities/admin-user";
import { useSession } from "@/entities/session";

export interface EditUserDialogProps {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const editUserFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(100, "Display name must be at most 100 characters"),
  username: z
    .string()
    .trim()
    .refine(
      (val) => !val || USERNAME_REGEX.test(val.toLowerCase()),
      "Username must be 3-30 characters (letters, numbers, underscore, hyphen)",
    ),
  telegramUsername: z
    .string()
    .trim()
    .refine(
      (val) => !val || TELEGRAM_USERNAME_REGEX.test(val),
      "Telegram username must be 5-32 characters",
    ),
  gitUrl: z
    .string()
    .trim()
    .refine(
      (val) => !val || GIT_URL_REGEX.test(val),
      "Git URL must be a valid GitHub or GitLab profile link",
    ),
  role: z.string(),
});

export type EditUserFormValues = z.infer<typeof editUserFormSchema>;

export function EditUserDialog({
  user,
  open,
  onOpenChange,
}: EditUserDialogProps) {
  const { t } = useTranslation("common");
  const toast = useToast();
  const queryClient = useQueryClient();
  const session = useSession({ optional: true });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSelf = Boolean(session?.userId && user && session.userId === user.id);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: {
      displayName: "",
      username: "",
      telegramUsername: "",
      gitUrl: "",
      role: SystemRole.USER,
    },
  });

  const selectedRole = watch("role") || SystemRole.USER;
  const updateMutation = useAdminUsersControllerUpdateUser();

  useEffect(() => {
    if (user && open) {
      reset({
        displayName: user.displayName ?? "",
        username: user.username ?? "",
        telegramUsername: user.telegramUsername ?? "",
        gitUrl: user.gitUrl ?? "",
        role: user.role ?? SystemRole.USER,
      });
    }
  }, [user, open, reset]);

  const handleClose = (nextOpen: boolean) => {
    if (isSubmitting) return;
    onOpenChange(nextOpen);
  };

  const onSubmit = async (data: EditUserFormValues) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const payload: UpdateUserAdminDto = {
        displayName: data.displayName?.trim() ? data.displayName.trim() : null,
        username: data.username?.trim() ? data.username.trim() : null,
        telegramUsername: data.telegramUsername?.trim()
          ? data.telegramUsername.trim()
          : null,
        gitUrl: data.gitUrl?.trim() ? data.gitUrl.trim() : null,
        role: isSelf ? undefined : data.role || undefined,
      };

      await updateMutation.mutateAsync({
        id: user.id,
        data: payload,
      });

      toast.push({
        status: "success",
        title: t("admin.users.editModal.successToast"),
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
        title: t("admin.users.editModal.errorToast"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <Dialog.Content className="sm:max-w-[500px]">
        <Dialog.Header>
          <Dialog.Title>{t("admin.users.editModal.title")}</Dialog.Title>
          <Dialog.Description>
            {t("admin.users.editModal.description")}
          </Dialog.Description>
        </Dialog.Header>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Email read-only */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              {t("admin.users.editModal.email")}
            </Label>
            <Input
              value={user?.email ?? ""}
              disabled
              className="h-9 text-sm bg-muted/40 cursor-not-allowed"
            />
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-display-name" className="text-xs font-medium">
              {t("admin.users.editModal.displayName")}
            </Label>
            <Input
              id="edit-display-name"
              {...register("displayName")}
              disabled={isSubmitting}
              className="h-9 text-sm"
            />
            {errors.displayName?.message && (
              <p className="text-xs text-destructive">
                {errors.displayName.message}
              </p>
            )}
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-username" className="text-xs font-medium">
              {t("admin.users.editModal.username")}
            </Label>
            <Input
              id="edit-username"
              {...register("username")}
              disabled={isSubmitting}
              className="h-9 text-sm"
            />
            {errors.username?.message && (
              <p className="text-xs text-destructive">
                {errors.username.message}
              </p>
            )}
          </div>

          {/* Telegram */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-telegram" className="text-xs font-medium">
              {t("admin.users.editModal.telegram")}
            </Label>
            <Input
              id="edit-telegram"
              placeholder={t("admin.users.editModal.telegramPlaceholder")}
              {...register("telegramUsername")}
              disabled={isSubmitting}
              className="h-9 text-sm"
            />
            {errors.telegramUsername?.message && (
              <p className="text-xs text-destructive">
                {errors.telegramUsername.message}
              </p>
            )}
          </div>

          {/* Git URL */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-git" className="text-xs font-medium">
              {t("admin.users.editModal.gitUrl")}
            </Label>
            <Input
              id="edit-git"
              placeholder={t("admin.users.editModal.gitUrlPlaceholder")}
              {...register("gitUrl")}
              disabled={isSubmitting}
              className="h-9 text-sm"
            />
            {errors.gitUrl?.message && (
              <p className="text-xs text-destructive">
                {errors.gitUrl.message}
              </p>
            )}
          </div>

          {/* Role with Self-Role Protection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {t("admin.users.editModal.role")}
            </Label>
            <Select
              value={selectedRole}
              onValueChange={(val) => setValue("role", val)}
              disabled={isSubmitting || isSelf}
            >
              <Select.Trigger
                className="w-full h-9 text-sm"
                data-testid="edit-user-role-select"
              >
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value={SystemRole.USER}>
                  {t("admin.users.roles.user")}
                </Select.Item>
                <Select.Item value={SystemRole.ADMIN}>
                  {t("admin.users.roles.admin")}
                </Select.Item>
              </Select.Content>
            </Select>
            {isSelf && (
              <p
                className="text-[11px] text-amber-500 font-medium"
                data-testid="self-role-warning"
              >
                {t("admin.users.selfProtection.cannotChangeOwnRole")}
              </p>
            )}
          </div>

          <Dialog.Footer className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isSubmitting}
            >
              {t("common.cancel", "Отмена")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? t("common.loading", "Загрузка...")
                : t("admin.users.editModal.submit")}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}
