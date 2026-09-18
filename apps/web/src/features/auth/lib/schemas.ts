import {
  type ForgotPasswordDto,
  forgotPasswordSchema,
  type LoginDto,
  loginSchema,
  RESET_PASSWORD_ERROR_CODES,
  type RegisterDto,
  type ResetPasswordDto,
  type ResetPasswordErrorCode,
  type ResetPasswordErrorPayload,
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
  type ResetPasswordErrorCode,
  type ResetPasswordErrorPayload,
  RESET_PASSWORD_ERROR_CODES,
};

export type RegisterFormValues = z.input<typeof registerSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
