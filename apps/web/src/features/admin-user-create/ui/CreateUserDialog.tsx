"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAdminUsersControllerCreateUser } from "@packages/api";
import { type CreateUserAdminDto, USERNAME_REGEX } from "@packages/dto";
import { SystemRole } from "@packages/types";
import { Button, Dialog, Input, Label, Select, useToast } from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

export interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const createUserFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email обязателен")
    .pipe(z.email("Некорректный email")),
  role: z.string(),
  username: z
    .string()
    .trim()
    .refine(
      (val) => !val || USERNAME_REGEX.test(val.toLowerCase()),
      "Username must be 3-30 characters (letters, numbers, underscore, hyphen)",
    ),
  displayName: z
    .string()
    .trim()
    .max(100, "Display name must be at most 100 characters"),
});

export type CreateUserFormValues = z.infer<typeof createUserFormSchema>;

export function CreateUserDialog({
  open,
  onOpenChange,
}: CreateUserDialogProps) {
  const { t } = useTranslation("common");
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: {
      email: "",
      role: SystemRole.USER,
      username: "",
      displayName: "",
    },
  });

  const selectedRole = watch("role") || SystemRole.USER;
  const createMutation = useAdminUsersControllerCreateUser();

  const handleClose = (nextOpen: boolean) => {
    if (isSubmitting) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      reset();
    }
  };

  const onSubmit = async (data: CreateUserFormValues) => {
    setIsSubmitting(true);
    try {
      const payload: CreateUserAdminDto = {
        email: data.email.trim(),
        role: data.role || SystemRole.USER,
        username: data.username?.trim() ? data.username.trim() : undefined,
        displayName: data.displayName?.trim()
          ? data.displayName.trim()
          : undefined,
        isActive: true,
      };

      await createMutation.mutateAsync({ data: payload });

      toast.push({
        status: "success",
        title: t("admin.users.createModal.successToast"),
      });

      await queryClient.invalidateQueries({
        queryKey: ["/api/v1/admin/users"],
      });

      handleClose(false);
    } catch (err: unknown) {
      const errorObj = err as {
        status?: number;
        response?: { status?: number };
      };
      const status = errorObj?.status ?? errorObj?.response?.status;

      if (status === 409) {
        toast.push({
          status: "error",
          title: t("admin.users.createModal.conflictError"),
        });
      } else {
        toast.push({
          status: "error",
          title: t("admin.users.createModal.errorToast"),
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <Dialog.Content className="sm:max-w-[480px]">
        <Dialog.Header>
          <Dialog.Title>{t("admin.users.createModal.title")}</Dialog.Title>
          <Dialog.Description>
            {t("admin.users.createModal.description")}
          </Dialog.Description>
        </Dialog.Header>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="create-email" className="text-xs font-medium">
              {t("admin.users.createModal.email")} *
            </Label>
            <Input
              id="create-email"
              type="email"
              placeholder={t("admin.users.createModal.emailPlaceholder")}
              {...register("email")}
              disabled={isSubmitting}
              className="h-9 text-sm"
            />
            {errors.email?.message && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <Label htmlFor="create-username" className="text-xs font-medium">
              {t("admin.users.createModal.username")}
            </Label>
            <Input
              id="create-username"
              placeholder={t("admin.users.createModal.usernamePlaceholder")}
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

          {/* Display Name */}
          <div className="space-y-1.5">
            <Label
              htmlFor="create-display-name"
              className="text-xs font-medium"
            >
              {t("admin.users.createModal.displayName")}
            </Label>
            <Input
              id="create-display-name"
              placeholder={t("admin.users.createModal.displayNamePlaceholder")}
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

          {/* Role */}
          <div className="space-y-1.5">
            <Label htmlFor="create-role" className="text-xs font-medium">
              {t("admin.users.createModal.role")}
            </Label>
            <Select
              value={selectedRole}
              onValueChange={(val) => setValue("role", val)}
              disabled={isSubmitting}
            >
              <Select.Trigger
                id="create-role"
                aria-label={t("admin.users.createModal.role")}
                className="w-full h-9 text-sm"
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
                : t("admin.users.createModal.submit")}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}
