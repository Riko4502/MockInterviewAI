"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
  Input,
} from "@packages/ui";
import { useForm } from "react-hook-form";
import { type LoginFormValues, loginSchema } from "../lib/schemas";

export function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginFormValues) => {
    console.log("Login payload:", data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field>
        <FieldLabel>Email</FieldLabel>
        <FieldContent>
          <Input
            type="email"
            placeholder="example@mail.com"
            data-invalid={!!errors.email}
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          <FieldError>{errors.email?.message}</FieldError>
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel>Пароль</FieldLabel>
        <FieldContent>
          <Input
            type="password"
            placeholder="Введите пароль"
            data-invalid={!!errors.password}
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          <FieldError>{errors.password?.message}</FieldError>
        </FieldContent>
      </Field>

      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="w-full mt-4"
      >
        Войти
      </Button>
    </form>
  );
}
