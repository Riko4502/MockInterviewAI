import type { PublicUserCardDto } from "@packages/dto";

/**
 * Константные лимиты для Showcase.
 */
export const SHOWCASE_LIMITS = {
  MAX_ACTIVE_CARDS_PER_USER: 5,
  CARD_TTL_DAYS: 15,
  BUMP_COOLDOWN_HOURS: 24,
  MATCH_REQUEST_TTL_DAYS: 7,
} as const;

/**
 * Безопасная проекция публичной визитки автора карточки витрины.
 * Гарантирует на этапе компиляции соответствие контракту PublicUserCardDto.
 */
export const PUBLIC_USER_SELECT = {
  id: true,
  displayName: true,
  username: true,
  avatarUrl: true,
  telegramUsername: true,
  gitUrl: true,
} as const satisfies Record<keyof PublicUserCardDto, true>;
