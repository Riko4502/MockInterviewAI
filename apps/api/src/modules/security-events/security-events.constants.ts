/**
 * Redis-ключ одноразового кода отвязки Telegram (plan D5).
 *
 * Значение — JSON `{ hash, attempts, expiresAt }`; сам код в Redis не
 * хранится, только SHA-256 хеш (D14).
 */
export const TELEGRAM_UNLINK_REDIS_PREFIX = "telegram:unlink:";

/** TTL одноразового кода отвязки — 10 минут (D5). */
export const TELEGRAM_UNLINK_TTL_SECONDS = 10 * 60;

/** Сколько минут показывать боту в тексте сообщения. */
export const TELEGRAM_UNLINK_TTL_MINUTES = 10;

/** Максимум неверных вводов кода до инвалидации записи (D5). */
export const TELEGRAM_UNLINK_MAX_ATTEMPTS = 5;

/** Сколько строк забирает один проход relay за раз. */
export const SECURITY_RELAY_BATCH_SIZE = 50;

/** После стольких неудач доставка больше не повторяется (событие остаётся in-app). */
export const SECURITY_RELAY_MAX_ATTEMPTS = 5;

/** Базовая задержка backoff — минута, далее x2 (как у outbox-релея). */
export const SECURITY_RELAY_BASE_BACKOFF_MS = 60_000;

/** Сколько монотонных проходов relay'я между проверками (D7). */
export const SECURITY_RELAY_INTERVAL_CRON = "*/10 * * * * *";

/** Политика ретенции security-событий — 12 месяцев (ADR-005:126, D12). */
export const SECURITY_EVENT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

/** Размер пакета удаления при очистке по ретенции. */
export const SECURITY_EVENT_RETENTION_BATCH_SIZE = 1000;

/**
 * Metadata отвязки из веб-эндпоинтов.
 *
 * `channel: "web"` отличает веб-флоу от ботовой команды `/unlink` (D11): в
 * аудите видно, каким путём привязка была снята. Это не персональные данные,
 * поэтому поле можно отдавать в аудит без ограничений.
 */
export const SECURITY_EVENT_UNLINK_METADATA = { channel: "web" } as const;
