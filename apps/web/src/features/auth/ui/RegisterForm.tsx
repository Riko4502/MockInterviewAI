"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthControllerRegister } from "@packages/api";
import { registerSchema } from "@packages/dto";
import { Button, Field, Input, Typography } from "@packages/ui";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useSession } from "@/entities/session";
import type { RegisterFormValues } from "../lib/schemas";

export function RegisterForm() {
  const router = useRouter();

  const { startSession } = useSession();

  const registerMutation = useAuthControllerRegister({
    mutation: {
      onSuccess: (data) => {
        startSession(data.accessToken);
        router.replace("/");
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
    registerMutation.mutate({ data });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      noValidate
    >
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

      <Field invalid={!!errors.passwordConfirmation}>
        <Field.Label>Подтверждение пароля</Field.Label>
        <Field.Content>
          <Input
            type="password"
            placeholder="Введите пароль"
            data-invalid={!!errors.passwordConfirmation}
            aria-invalid={!!errors.passwordConfirmation}
            {...register("passwordConfirmation")}
          />
          <Field.Error>{errors.passwordConfirmation?.message}</Field.Error>
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
        <Typography.P className="text-sm text-destructive">
          Ошибка регистрации. Попробуйте снова.
        </Typography.P>
      )}
    </form>
  );
}
