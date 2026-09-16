"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthControllerForgotPassword } from "@packages/api";
import { Button, Field, Input } from "@packages/ui";
import Link from "next/link";
import { useForm } from "react-hook-form";
import {
  type ForgotPasswordFormValues,
  forgotPasswordSchema,
} from "../../lib/schemas";
import { ForgotPasswordSuccess } from "./ForgotPasswordSuccess.tsx";

export function ForgotPasswordForm() {
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
        <Field.Label>Email</Field.Label>
        <Field.Content>
          <Input
            type="email"
            placeholder="example@mail.com"
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
          ? "Отправка..."
          : "Отправить ссылку для сброса"}
      </Button>

      {forgotPasswordMutation.isError && (
        <p className="text-sm text-destructive">
          Не удалось отправить письмо. Проверьте email и попробуйте снова.
        </p>
      )}

      <Link
        href="/login"
        className="text-sm text-center text-muted-foreground hover:text-foreground hover:underline"
      >
        Вернуться ко входу
      </Link>
    </form>
  );
}
