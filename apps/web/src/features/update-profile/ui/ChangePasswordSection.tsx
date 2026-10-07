"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type ChangePasswordDto, changePasswordSchema } from "@packages/dto";
import { Button, Card, Field, Input, Spin, useToast } from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSession } from "@/entities/session";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";
import { useChangePassword } from "../model/use-profile-mutations";

export const CHANGE_PASSWORD_REDIRECT_DELAY_MS = 2000;

export function ChangePasswordSection() {
  const { t } = useTranslation(["common", "auth"]);
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession({ optional: true });
  const toast = useToast();
  const changePasswordMutation = useChangePassword();
  const [isSuccess, setIsSuccess] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<ChangePasswordDto>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      newPasswordConfirmation: "",
    },
    mode: "onTouched",
  });

  const isPending = changePasswordMutation.isPending;

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const onSubmit = (data: ChangePasswordDto) => {
    changePasswordMutation.mutate(
      { data },
      {
        onSuccess: () => {
          reset();
          setIsSuccess(true);
          toast.push({
            status: "success",
            title: t("profile.changePasswordSuccess"),
          });

          redirectTimerRef.current = setTimeout(() => {
            session?.clearSession();
            queryClient.clear();
            router.replace(paths.login);
          }, CHANGE_PASSWORD_REDIRECT_DELAY_MS);
        },
        onError: (error: unknown) => {
          const status =
            (error as { status?: number })?.status ??
            (error as { response?: { status?: number } })?.response?.status;
          const rawData =
            (error as { data?: unknown })?.data ??
            (error as { response?: { data?: unknown } })?.response?.data;
          const message =
            typeof rawData === "object" &&
            rawData !== null &&
            "message" in rawData
              ? (rawData as { message: unknown }).message
              : (error as { message?: string })?.message;

          if (
            status === 401 ||
            (typeof message === "string" &&
              (message.includes("Неверные учётные данные") ||
                message.toLowerCase().includes("credentials") ||
                message.toLowerCase().includes("current password")))
          ) {
            setError("currentPassword", {
              type: "server",
              message: t("profile.wrongCurrentPassword"),
            });
            return;
          }

          if (
            status === 400 &&
            typeof message === "string" &&
            (message.includes("отличаться") ||
              message.toLowerCase().includes("different"))
          ) {
            setError("newPassword", {
              type: "server",
              message: t("profile.samePassword"),
            });
            return;
          }

          if (status === 400 && Array.isArray(message)) {
            toast.push({
              status: "error",
              title: message.join(", "),
            });
            return;
          }

          toast.push({
            status: "error",
            title: t("profile.changePasswordError"),
          });
        },
      },
    );
  };

  return (
    <Card>
      <Card.Content className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">
            {t("profile.securityTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("profile.securitySubtitle")}
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <Field invalid={!!errors.currentPassword}>
            <Field.Label>{t("profile.currentPassword")}</Field.Label>
            <Field.Content>
              <Input
                type="password"
                placeholder={t("profile.currentPasswordPlaceholder")}
                autoComplete="current-password"
                data-invalid={!!errors.currentPassword}
                aria-invalid={!!errors.currentPassword}
                disabled={isPending || isSuccess}
                showPasswordLabel={t("auth:fields.showPassword")}
                hidePasswordLabel={t("auth:fields.hidePassword")}
                {...register("currentPassword")}
              />
              <Field.Error>{errors.currentPassword?.message}</Field.Error>
            </Field.Content>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field invalid={!!errors.newPassword}>
              <Field.Label>{t("profile.newPassword")}</Field.Label>
              <Field.Content>
                <Input
                  type="password"
                  placeholder={t("profile.newPasswordPlaceholder")}
                  autoComplete="new-password"
                  data-invalid={!!errors.newPassword}
                  aria-invalid={!!errors.newPassword}
                  disabled={isPending || isSuccess}
                  showPasswordLabel={t("auth:fields.showPassword")}
                  hidePasswordLabel={t("auth:fields.hidePassword")}
                  {...register("newPassword")}
                />
                <Field.Description>
                  {t("profile.newPasswordHint")}
                </Field.Description>
                <Field.Error>{errors.newPassword?.message}</Field.Error>
              </Field.Content>
            </Field>

            <Field invalid={!!errors.newPasswordConfirmation}>
              <Field.Label>{t("profile.confirmNewPassword")}</Field.Label>
              <Field.Content>
                <Input
                  type="password"
                  placeholder={t("profile.confirmNewPasswordPlaceholder")}
                  autoComplete="new-password"
                  data-invalid={!!errors.newPasswordConfirmation}
                  aria-invalid={!!errors.newPasswordConfirmation}
                  disabled={isPending || isSuccess}
                  showPasswordLabel={t("auth:fields.showPassword")}
                  hidePasswordLabel={t("auth:fields.hidePassword")}
                  {...register("newPasswordConfirmation")}
                />
                <Field.Error>
                  {errors.newPasswordConfirmation?.message}
                </Field.Error>
              </Field.Content>
            </Field>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-5 text-sm">
              {isSuccess ? (
                <p className="text-muted-foreground">
                  {t("profile.changePasswordSuccess")}
                </p>
              ) : changePasswordMutation.isError &&
                !errors.currentPassword &&
                !errors.newPassword ? (
                <p className="text-destructive">
                  {t("profile.changePasswordError")}
                </p>
              ) : null}
            </div>

            <Button
              type="submit"
              className="sm:w-auto"
              disabled={!isDirty || isPending || isSuccess}
              aria-busy={isPending}
            >
              {isPending ? (
                <Spin size="sm" variant="current" aria-hidden="true" />
              ) : null}
              {isPending
                ? t("profile.changePasswordSaving")
                : t("profile.changePasswordButton")}
            </Button>
            {isPending ? (
              <output aria-live="polite" className="sr-only">
                {t("profile.changePasswordSaving")}
              </output>
            ) : null}
          </div>
        </form>
      </Card.Content>
    </Card>
  );
}
