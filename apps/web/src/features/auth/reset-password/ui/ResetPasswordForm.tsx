"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthControllerResetPassword } from "@packages/api";
import { EyeIcon, EyeOffIcon } from "@packages/icons";
import { Button, Field, Input, useToast } from "@packages/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { HttpError } from "@/shared/api";
import {
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
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const resetPasswordMutation = useAuthControllerResetPassword({
    mutation: {
      onSuccess: () => {
        toast.push({
          status: "success",
          title: "Пароль успешно обновлен",
        });
        setTimeout(() => router.push("/login"), REDIRECT_DELAY_MS);
      },
    },
  });

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
    resetPasswordMutation.error.status === 400;

  if (isTokenInvalid) {
    return <InvalidTokenAlert />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field invalid={!!errors.newPassword}>
        <Field.Label>Новый пароль</Field.Label>
        <Field.Content>
          <Field.Description>Минимум 12 символов</Field.Description>
          <div className="relative">
            <Input
              type={isPasswordVisible ? "text" : "password"}
              placeholder="Введите новый пароль"
              data-invalid={!!errors.newPassword}
              aria-invalid={!!errors.newPassword}
              className="pr-10"
              {...register("newPassword")}
            />
            <button
              type="button"
              onClick={() => setIsPasswordVisible((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={
                isPasswordVisible ? "Скрыть пароль" : "Показать пароль"
              }
            >
              {isPasswordVisible ? (
                <EyeOffIcon className="size-4" />
              ) : (
                <EyeIcon className="size-4" />
              )}
            </button>
          </div>
          <Field.Error>{errors.newPassword?.message}</Field.Error>
        </Field.Content>
      </Field>

      <Field invalid={!!errors.newPasswordConfirmation}>
        <Field.Label>Подтверждение пароля</Field.Label>
        <Field.Content>
          <Input
            type="password"
            placeholder="Повторите новый пароль"
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
          ? "Сохранение..."
          : "Сохранить новый пароль"}
      </Button>

      {resetPasswordMutation.isError && !isTokenInvalid && (
        <p className="text-sm text-destructive">
          Не удалось сохранить пароль. Попробуйте снова.
        </p>
      )}
    </form>
  );
}
