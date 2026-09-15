import {
  type LoginDto,
  loginSchema,
  normalizeEmail,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type RegisterDto,
  registerSchema,
} from "@packages/dto";
import { z } from "zod";

export { loginSchema, registerSchema, type LoginDto, type RegisterDto };

export type RegisterFormValues = z.input<typeof registerSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email обязателен")
    .pipe(z.email("Некорректный email"))
    .transform(normalizeEmail),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(
        PASSWORD_MIN_LENGTH,
        `Пароль должен содержать минимум ${PASSWORD_MIN_LENGTH} символов`,
      )
      .max(
        PASSWORD_MAX_LENGTH,
        `Пароль должен содержать максимум ${PASSWORD_MAX_LENGTH} символов`,
      ),
    newPasswordConfirmation: z
      .string()
      .min(1, "Подтверждение пароля обязательно"),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirmation, {
    message: "Пароли не совпадают",
    path: ["newPasswordConfirmation"],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
