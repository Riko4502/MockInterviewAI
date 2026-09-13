import {
  type LoginDto,
  loginSchema,
  type RegisterDto,
  registerSchema,
} from "@packages/dto";
import type { z } from "zod";

export { loginSchema, registerSchema, type LoginDto, type RegisterDto };

/**
 * Значения, которые вводит пользователь в форме регистрации.
 */
export type RegisterFormValues = z.input<typeof registerSchema>;

export type LoginFormValues = z.infer<typeof loginSchema>;
