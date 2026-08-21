"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@packages/ui";
import { useForm } from "react-hook-form";
import { type RegisterFormValues, registerSchema } from "../lib/schemas";
import { Field } from "./Field";

export function RegisterForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = (data: RegisterFormValues) => {
    const { confirmPassword: _, ...payload } = data;
    console.log("Register payload:", payload);
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

      <Field
        label="Подтверждение пароля"
        type="password"
        placeholder="••••••"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />

      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="w-full mt-4"
      >
        Зарегистрироваться
      </Button>
    </form>
  );
}
