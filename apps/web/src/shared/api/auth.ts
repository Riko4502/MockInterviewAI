/**
 * Мутации аутентификации на TanStack Query.
 *
 * ## Использование
 *
 * ```tsx
 * import { useLoginMutation } from "@/shared/api/auth";
 *
 * function LoginForm() {
 *   const login = useLoginMutation();
 *
 *   login.mutate({ email, password }, {
 *     onSuccess: (res) => { /* сохранить токен, редирект *\/ },
 *   });
 * }
 * ```
 *
 * ## Важно
 *
 * - Запросы идут через `baseFetch` — токен и рефреш обрабатываются автоматически.
 * - При успехе возвращается `{ accessToken: string }`.
 */

import { useMutation } from "@tanstack/react-query";
import { baseFetch } from "./base";
import { endpoints } from "./endpoints";

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
}

interface AuthResponse {
  accessToken: string;
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: (data: LoginRequest) =>
      baseFetch<AuthResponse>(endpoints.auth.login, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: (data: RegisterRequest) =>
      baseFetch<AuthResponse>(endpoints.auth.register, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}
