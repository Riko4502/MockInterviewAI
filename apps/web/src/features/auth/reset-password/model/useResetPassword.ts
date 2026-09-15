import type {
  ErrorResponseDto,
  ValidationErrorResponseDto,
} from "@packages/api";
import { customInstance } from "@packages/api";
import { useMutation } from "@tanstack/react-query";

/** Тело запроса на установку нового пароля по токену из письма. */
export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

const RESET_PASSWORD_URL = "/api/v1/auth/reset-password";

/**
 * Мутация установки нового пароля по токену сброса.
 *
 * ВРЕМЕННАЯ РЕАЛИЗАЦИЯ
 *  Заменить на `useAuthControllerResetPassword` из `@packages/api`,
 * когда бэкенд реализует `POST /api/v1/auth/reset-password`.
 */

export function useResetPassword() {
  return useMutation<
    void,
    ErrorResponseDto | ValidationErrorResponseDto,
    ResetPasswordDto
  >({
    mutationKey: ["authControllerResetPassword"],
    mutationFn: (dto) =>
      customInstance<void>(RESET_PASSWORD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dto),
      }),
  });
}
