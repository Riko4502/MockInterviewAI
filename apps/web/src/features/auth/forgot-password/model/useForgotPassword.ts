import type {
  ErrorResponseDto,
  ValidationErrorResponseDto,
} from "@packages/api";
import { customInstance } from "@packages/api";
import { useMutation } from "@tanstack/react-query";

/** Тело запроса на восстановление пароля. */
export interface ForgotPasswordDto {
  email: string;
}

const FORGOT_PASSWORD_URL = "/api/v1/auth/forgot-password";

/**
 * Мутация запроса ссылки на сброс пароля.
 *
 * ВРЕМЕННАЯ РЕАЛИЗАЦИЯ бэкенд-эндпоинт
 * `POST /api/v1/auth/forgot-password` ещё не реализован.
 *
 * Как только бэкенд добавит эндпоинт и клиент перегенерируется через orval —
 * удалить этот файл и в `ForgotPasswordForm` заменить импорт на
 * `useAuthControllerForgotPassword` из `@packages/api`.
 */
export function useForgotPassword() {
  return useMutation<
    void,
    ErrorResponseDto | ValidationErrorResponseDto,
    ForgotPasswordDto
  >({
    mutationKey: ["authControllerForgotPassword"],
    mutationFn: (dto) =>
      customInstance<void>(FORGOT_PASSWORD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dto),
      }),
  });
}
