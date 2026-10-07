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
 * Как выбираются слоты карточки (ADR-002:60).
 *
 * Отбор идёт внутри `include`, поэтому выборка слотов не требует отдельного
 * запроса на каждую карточку (ADR-002:103: отдельная пагинация слотов не
 * вводится, слоты приходят вместе с карточкой).
 *
 * `CANCELLED` исключены намеренно: погашенный слот не должен попадать в ответ,
 * иначе клиент показывал бы время, на которое уже никто не придёт.
 */
export const CARD_SLOTS_INCLUDE = {
  slots: {
    where: { status: { not: "CANCELLED" } },
    orderBy: { startsAt: "asc" },
  },
} as const;

/**
 * Слот, который переживёт пересборку расписания: его занимает заявка, и он
 * принадлежит не расписанию, а встрече (ADR-002:62, :117).
 */
export const SURVIVING_SLOT_STATUS = "BOOKED" as const;

/**
 * Идентичность слота для сравнения пересобираемого расписания с текущим.
 *
 * Ключ составной намеренно: `startsAt` сам по себе не различает слоты, один из
 * которых 19:00-20:00, а другой 19:00-20:30 — а пересечение запрещено, но
 * граница 20:00 у обоих одна, и присутствие второго слота — это уже другая
 * встреча. Ключ включает длительность, поэтому и полное совпадение слота, и
 * его изменение распознаются однозначно.
 */
export const slotIdentity = (slot: {
  startsAt: Date;
  durationMinutes: number;
}): string => `${slot.startsAt.getTime()}:${slot.durationMinutes}`;

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
