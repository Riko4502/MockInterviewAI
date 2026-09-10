"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthControllerLogin } from "@packages/api";
import { loginSchema } from "@packages/dto";
import { Button, Field, Input } from "@packages/ui";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useSession } from "@/entities/session";
import type { LoginFormValues } from "../lib/schemas";

export function LoginForm() {
  const router = useRouter();
  const { startSession } = useSession();

  const loginMutation = useAuthControllerLogin({
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
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate({ data });
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

      <Button
        type="submit"
        size="lg"
        disabled={loginMutation.isPending}
        className="w-full mt-4"
      >
        {loginMutation.isPending ? "Вход..." : "Войти"}
      </Button>

      {loginMutation.isError && (
        <p className="text-sm text-destructive">
          Ошибка входа. Проверьте данные.
        </p>
      )}
    </form>
  );
}
