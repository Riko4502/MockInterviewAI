/**
 * Возвращает текущую IANA-таймзону браузера.
 *
 * Используется для авто-подстановки таймзоны при первом входе/регистрации
 * (ADR-002:53). Это единственный источник автоопределения на клиенте —
 * `Intl.supportedValuesOf("timeZone")` как allowlist не применяется (ADR-002:51).
 *
 * @returns IANA-идентификатор (например `Europe/Moscow`) либо `undefined`,
 *   если `Intl` недоступен — тогда сервер оставляет значение по умолчанию.
 */
export function getBrowserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}
