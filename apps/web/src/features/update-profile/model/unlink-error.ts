"use client";

import { SECURITY_UNLINK_ERROR_CODES } from "@packages/dto";

/**
 * Привязка, которую пытаемся отвязать — определяет fallback-текст ошибки (F7).
 */
export type UnlinkKind = "telegram" | "github";

/**
 * Машиночитаемый код ошибки отвязки (ADR-005 D4, контракт `{ code, message }`).
 *
 * Бэкенд прокидывает `code` наружу только как строку; внутренние поля тела
 * ошибки сюда не попадают.
 */
function extractErrorCode(error: unknown): string | undefined {
  const data = (error as { data?: unknown } | null)?.data;
  if (typeof data !== "object" || data === null) return undefined;
  const { code } = data as { code?: unknown };
  return typeof code === "string" ? code : undefined;
}

/** HTTP-статус ошибки, если транспорт его сохранил. */
function extractStatus(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

/**
 * Коды, после которых сервер инвалидировал запись кода: нужен новый запрос.
 *
 * `CODE_EXPIRED` — истёк TTL, `ATTEMPTS_EXCEEDED` — превышен лимит попыток (D5).
 * `INVALID_CODE` сюда не входит: одна ошибка не должна обнулять уже введённый
 * прогресс — пользователь может ввести верный код, пока записи ещё живы.
 */
export function isCodeInvalidatingError(error: unknown): boolean {
  const code = extractErrorCode(error);
  return (
    code === SECURITY_UNLINK_ERROR_CODES.CODE_EXPIRED ||
    code === SECURITY_UNLINK_ERROR_CODES.ATTEMPTS_EXCEEDED
  );
}

/**
 * Мапит ошибку мутаций отвязки на i18n-ключ текста (F7).
 *
 * Читаются только `status` и машиночитаемый `code` — текст сообщения сервера
 * не разбирается, он может быть локализован произвольно.
 *
 * @param error - Ошибка мутации (HttpError из транспорта приложения).
 * @param kind - Привязка, для которой показывается текст.
 * @returns i18n-ключ вида `profile.*`, всегда определён.
 */
export function getUnlinkErrorKey(
  error: unknown,
  kind: UnlinkKind,
): `profile.${string}` {
  const fallback =
    kind === "telegram"
      ? "profile.telegramUnlinkErrorGeneric"
      : "profile.githubUnlinkErrorGeneric";

  switch (extractErrorCode(error)) {
    case SECURITY_UNLINK_ERROR_CODES.LAST_AUTH_METHOD:
      return "profile.githubUnlinkErrorLastMethod";
    case SECURITY_UNLINK_ERROR_CODES.INVALID_CODE:
      return "profile.telegramUnlinkErrorInvalidCode";
    case SECURITY_UNLINK_ERROR_CODES.CODE_EXPIRED:
      return "profile.telegramUnlinkErrorExpired";
    case SECURITY_UNLINK_ERROR_CODES.ATTEMPTS_EXCEEDED:
      return "profile.telegramUnlinkErrorAttempts";
    case SECURITY_UNLINK_ERROR_CODES.ALREADY_UNLINKED:
      return "profile.telegramUnlinkErrorAlreadyUnlinked";
    case SECURITY_UNLINK_ERROR_CODES.TELEGRAM_NOT_LINKED:
    case SECURITY_UNLINK_ERROR_CODES.GITHUB_NOT_LINKED:
      return fallback;
    case "TOO_MANY_REQUESTS":
      return "profile.telegramUnlinkErrorRateLimited";
  }

  // Rate limit отдаётся штатным ThrottlerGuard: `{ statusCode: 429 }` без кода.
  return extractStatus(error) === 429
    ? "profile.telegramUnlinkErrorRateLimited"
    : fallback;
}
