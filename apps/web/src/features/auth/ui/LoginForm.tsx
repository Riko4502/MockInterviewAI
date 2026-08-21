"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@packages/ui";
import { useForm } from "react-hook-form";
import { type LoginFormValues, loginSchema } from "../lib/schemas";
import { Field } from "./Field";

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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
      <Field
        label="Email"
        type="email"
        placeholder="example@mail.com"
        error={errors.email?.message}
        {...register("email")}
      />

      <Field
        label="Пароль"
        type="password"
        placeholder="••••••"
        error={errors.password?.message}
        {...register("password")}
      />

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
