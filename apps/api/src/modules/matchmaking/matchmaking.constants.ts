/**
 * Константные лимиты и параметры для модуля Matchmaking.
 */
export const MATCHMAKING_LIMITS = {
  /** Максимальное количество активных входящих заявок (PENDING) на одну карточку витрины */
  MAX_PENDING_INCOMING_PER_CARD: 10,

  /** Максимальное количество активных исходящих заявок (PENDING) от одного пользователя */
  MAX_PENDING_OUTGOING_PER_USER: 5,

  /** Срок жизни заявки в часах (72 часа = 3 суток) */
  REQUEST_TTL_HOURS: 72,

  /** Кулдаун после отклонения заявки в часах (24 часа до повторного отклика тому же пользователю) */
  REJECT_COOLDOWN_HOURS: 24,
} as const;

/**
 * Имя Redis Pub/Sub канала для событий матчмейкинга.
 * Используется для уведомлений и межсервисного взаимодействия при подтверждении матча.
 */
export const REDIS_MATCHMAKING_EVENTS_CHANNEL = "matchmaking:events";

/**
 * Redis-ключ распределённого лока для крон-задачи очистки просроченных заявок.
 */
export const MATCHMAKING_EXPIRY_LOCK_KEY = "lock:cron:matchmaking-expiry";

/**
 * Время жизни распределённого лока в секундах (1 час).
 */
export const MATCHMAKING_EXPIRY_LOCK_TTL_SECONDS = 3600;
