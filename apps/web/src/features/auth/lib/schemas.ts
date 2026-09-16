import {
  type ForgotPasswordDto,
  forgotPasswordSchema,
  type LoginDto,
  loginSchema,
  type RegisterDto,
  type ResetPasswordDto,
  registerSchema,
  resetPasswordSchema,
} from "@packages/dto";
import type { z } from "zod";

export {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type LoginDto,
  type RegisterDto,
  type ForgotPasswordDto,
  type ResetPasswordDto,
};

export type RegisterFormValues = z.input<typeof registerSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
