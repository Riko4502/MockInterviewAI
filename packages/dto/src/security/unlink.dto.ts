import { z } from "zod";

/**
 * Коды ошибок флоу безопасной отвязки (ADR-005, backend-спека §1.1 D4).
 *
 * Тело ошибки — `{ code, message }`, как у сброса пароля
 * (`reset-password.dto.ts`): фронт мапит код на i18n-ключ (F7), а не
 * разбирает текст сообщения.
 */
export const SECURITY_UNLINK_ERROR_CODES = {
  TELEGRAM_NOT_LINKED: "TELEGRAM_NOT_LINKED",
  GITHUB_NOT_LINKED: "GITHUB_NOT_LINKED",
  INVALID_CODE: "INVALID_CODE",
  CODE_EXPIRED: "CODE_EXPIRED",
  ALREADY_UNLINKED: "ALREADY_UNLINKED",
  ATTEMPTS_EXCEEDED: "ATTEMPTS_EXCEEDED",
  LAST_AUTH_METHOD: "LAST_AUTH_METHOD",
} as const;

export type SecurityUnlinkErrorCode =
  (typeof SECURITY_UNLINK_ERROR_CODES)[keyof typeof SECURITY_UNLINK_ERROR_CODES];

/**
 * Одноразовый код отвязки Telegram (ADR-005:80, plan D5).
 *
 * Проверяется только форма (6 цифр): сравнение с хешем и лимит попыток —
 * на стороне сервиса, а сообщения валидации не должны различать «код не той
 * длины» и «код неверный» настолько, чтобы помогать перебору.
 */
export const confirmTelegramUnlinkSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Код должен состоять из 6 цифр"),
});

/** Типизированный DTO подтверждения отвязки Telegram. */
export type ConfirmTelegramUnlinkDto = z.infer<
  typeof confirmTelegramUnlinkSchema
>;

/** Ответ на запрос кода отвязки: код отправлен ботом, срок действия известен. */
export const telegramUnlinkRequestResponseSchema = z.object({
  sent: z.literal(true),
  expiresAt: z.iso.datetime(),
});

export type TelegramUnlinkRequestResponseDto = z.infer<
  typeof telegramUnlinkRequestResponseSchema
>;

/** Результат успешной отвязки привязки. */
export const securityUnlinkResponseSchema = z.object({
  success: z.literal(true),
});

export type SecurityUnlinkResponseDto = z.infer<
  typeof securityUnlinkResponseSchema
>;
