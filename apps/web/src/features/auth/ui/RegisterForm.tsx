"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type RegisterDto, useAuthControllerRegister } from "@packages/api";
import { Button, Field, Input } from "@packages/ui";
import { useForm } from "react-hook-form";
import { type RegisterFormValues, registerSchema } from "../lib/schemas";

export function RegisterForm() {
  const registerMutation = useAuthControllerRegister({
    mutation: {
      onSuccess: (data) => {
        sessionStorage.setItem("accessToken", data.accessToken);
        window.location.href = "/";
      },
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = (data: RegisterFormValues) => {
    const payload: RegisterDto = {
      email: data.email,
      password: data.password,
      passwordConfirmation: data.confirmPassword,
    };

    registerMutation.mutate({ data: payload });
  };

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

      <Field invalid={!!errors.password}>
        <Field.Label>Пароль</Field.Label>
        <Field.Content>
          <Input
            type="password"
            placeholder="Введите пароль"
            data-invalid={!!errors.password}
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          <Field.Error>{errors.password?.message}</Field.Error>
        </Field.Content>
      </Field>

      <Field invalid={!!errors.confirmPassword}>
        <Field.Label>Подтверждение пароля</Field.Label>
        <Field.Content>
          <Input
            type="password"
            placeholder="Введите пароль"
            data-invalid={!!errors.confirmPassword}
            aria-invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
          <Field.Error>{errors.confirmPassword?.message}</Field.Error>
        </Field.Content>
      </Field>

      <Button
        type="submit"
        size="lg"
        disabled={registerMutation.isPending}
        className="w-full mt-4"
      >
        {registerMutation.isPending ? "Регистрация..." : "Зарегистрироваться"}
      </Button>

      {registerMutation.isError && (
        <p className="text-sm text-destructive">
          Ошибка регистрации. Попробуйте снова.
        </p>
      )}
    </form>
  );
}
