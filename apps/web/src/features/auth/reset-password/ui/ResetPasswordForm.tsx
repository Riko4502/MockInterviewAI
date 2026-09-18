"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthControllerResetPassword } from "@packages/api";
import { Button, Field, Input, useToast } from "@packages/ui";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { HttpError } from "@/shared/api";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";
import { getErrorMessage } from "../../lib/getErrorMessage";
import {
  RESET_PASSWORD_ERROR_CODES,
  type ResetPasswordErrorPayload,
  type ResetPasswordFormValues,
  resetPasswordSchema,
} from "../../lib/schemas";
import { InvalidTokenAlert } from "./InvalidTokenAlert";

interface ResetPasswordFormProps {
  token: string;
}

const REDIRECT_DELAY_MS = 2000;

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const toast = useToast();
  const { t } = useTranslation("auth");

  const resetPasswordMutation = useAuthControllerResetPassword();

  useEffect(() => {
    if (!resetPasswordMutation.isSuccess) return;

    toast.push({
      status: "success",
      title: t("resetPassword.successToast"),
    });

    const timer = setTimeout(() => {
      router.push(paths.login);
    }, REDIRECT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [resetPasswordMutation.isSuccess, router, t, toast]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  const onSubmit = (data: ResetPasswordFormValues) => {
    resetPasswordMutation.mutate({ data });
  };

  const isTokenInvalid =
    resetPasswordMutation.error instanceof HttpError &&
    resetPasswordMutation.error.status === 400 &&
    (resetPasswordMutation.error.data as ResetPasswordErrorPayload | undefined)
      ?.code === RESET_PASSWORD_ERROR_CODES.INVALID_TOKEN;

  if (isTokenInvalid) {
    return <InvalidTokenAlert />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field invalid={!!errors.newPassword}>
        <Field.Label>{t("fields.newPassword.label")}</Field.Label>
        <Field.Content>
          <Field.Description>{t("fields.newPassword.hint")}</Field.Description>
          <Input
            type="password"
            placeholder={t("fields.newPassword.placeholder")}
            data-invalid={!!errors.newPassword}
            aria-invalid={!!errors.newPassword}
            showPasswordLabel={t("fields.showPassword")}
            hidePasswordLabel={t("fields.hidePassword")}
            {...register("newPassword")}
          />
          <Field.Error>{errors.newPassword?.message}</Field.Error>
        </Field.Content>
      </Field>

      <Field invalid={!!errors.newPasswordConfirmation}>
        <Field.Label>{t("fields.newPasswordConfirmation.label")}</Field.Label>
        <Field.Content>
          <Input
            type="password"
            placeholder={t("fields.newPasswordConfirmation.placeholder")}
            data-invalid={!!errors.newPasswordConfirmation}
            aria-invalid={!!errors.newPasswordConfirmation}
            {...register("newPasswordConfirmation")}
          />
          <Field.Error>{errors.newPasswordConfirmation?.message}</Field.Error>
        </Field.Content>
      </Field>

      <Button
        type="submit"
        size="lg"
        disabled={resetPasswordMutation.isPending}
        className="w-full mt-4"
      >
        {resetPasswordMutation.isPending
          ? t("resetPassword.submitting")
          : t("resetPassword.submit")}
      </Button>

      {resetPasswordMutation.isError && !isTokenInvalid && (
        <p className="text-sm text-destructive">
          {getErrorMessage(
            resetPasswordMutation.error,
            t("resetPassword.error"),
          )}
        </p>
      )}
    </form>
  );
}
