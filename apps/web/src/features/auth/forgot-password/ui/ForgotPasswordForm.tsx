"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthControllerForgotPassword } from "@packages/api";
import { Button, Field, Input } from "@packages/ui";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import {
  type ForgotPasswordFormValues,
  forgotPasswordSchema,
} from "../../lib/schemas";
import { ForgotPasswordSuccess } from "./ForgotPasswordSuccess";

export function ForgotPasswordForm() {
  const { t } = useTranslation("auth");
  const forgotPasswordMutation = useAuthControllerForgotPassword();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = (data: ForgotPasswordFormValues) => {
    forgotPasswordMutation.mutate({ data });
  };

  if (forgotPasswordMutation.isSuccess) {
    return (
      <ForgotPasswordSuccess
        email={getValues("email")}
        isResending={forgotPasswordMutation.isPending}
        onResend={() => forgotPasswordMutation.mutate({ data: getValues() })}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field invalid={!!errors.email}>
        <Field.Label>{t("fields.email.label")}</Field.Label>
        <Field.Content>
          <Input
            type="email"
            placeholder={t("fields.email.placeholder")}
            data-invalid={!!errors.email}
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          <Field.Error>{errors.email?.message}</Field.Error>
        </Field.Content>
      </Field>

      <Button
        type="submit"
        size="lg"
        disabled={forgotPasswordMutation.isPending}
        className="w-full mt-4"
      >
        {forgotPasswordMutation.isPending
          ? t("forgotPassword.submitting")
          : t("forgotPassword.submit")}
      </Button>

      {forgotPasswordMutation.isError && (
        <p className="text-sm text-destructive">{t("forgotPassword.error")}</p>
      )}

      <Link
        href="/login"
        className="text-sm text-center text-muted-foreground hover:text-foreground hover:underline"
      >
        {t("forgotPassword.backToLogin")}
      </Link>
    </form>
  );
}
