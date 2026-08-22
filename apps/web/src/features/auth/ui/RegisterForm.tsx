"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@packages/ui";
import { useForm } from "react-hook-form";
import { type RegisterFormValues, registerSchema } from "../lib/schemas";

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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FormItem>
        <FormLabel>Email</FormLabel>
        <FormControl>
          <Input
            type="email"
            placeholder="example@mail.com"
            data-invalid={!!errors.email}
            aria-invalid={!!errors.email}
            {...register("email")}
          />
        </FormControl>
        <FormMessage>{errors.email?.message}</FormMessage>
      </FormItem>

      <FormItem>
        <FormLabel>Пароль</FormLabel>
        <FormControl>
          <Input
            type="password"
            placeholder="Введите пароль"
            data-invalid={!!errors.password}
            aria-invalid={!!errors.password}
            {...register("password")}
          />
        </FormControl>
        <FormMessage>{errors.password?.message}</FormMessage>
      </FormItem>

      <FormItem>
        <FormLabel>Подтверждение пароля</FormLabel>
        <FormControl>
          <Input
            type="password"
            placeholder="Введите пароль"
            data-invalid={!!errors.confirmPassword}
            aria-invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
        </FormControl>
        <FormMessage>{errors.confirmPassword?.message}</FormMessage>
      </FormItem>

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
