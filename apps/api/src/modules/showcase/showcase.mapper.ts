import type {
  ShowcaseCardResponseDto,
  ShowcaseCardStatsDto,
  ShowcaseSlotResponseDto,
} from "@packages/dto";

import type { Prisma } from "../../generated/prisma/client";
import { CARD_SLOTS_INCLUDE, PUBLIC_USER_SELECT } from "./showcase.constants";

/**
 * Карточка витрины вместе с публичной визиткой автора и слотами расписания.
 *
 * Это результат всех чтений, которые попадают в ответ: `user` выбирается
 * ровно одним способом, `PUBLIC_USER_SELECT`, а слоты — константой
 * `CARD_SLOTS_INCLUDE`, поэтому и форма, и DTO совпадают по построению, а не
 * по проверке в рантайме.
 */
export type ShowcaseCardWithUser = Prisma.ShowcaseCardGetPayload<{
  include: {
    user: { select: typeof PUBLIC_USER_SELECT };
    slots: (typeof CARD_SLOTS_INCLUDE)["slots"];
  };
}>;

/** Приводит запись слота к `ShowcaseSlotResponseDto`. */
export function toShowcaseSlotResponse(slot: {
  id: string;
  startsAt: Date;
  durationMinutes: number;
  status: "OPEN" | "BOOKED" | "CANCELLED";
}): ShowcaseSlotResponseDto {
  return {
    id: slot.id,
    startsAt: slot.startsAt.toISOString(),
    durationMinutes: slot.durationMinutes,
    status: slot.status,
  };
}

/**
 * Приводит запись Prisma к `ShowcaseCardResponseDto`.
 *
 * Единственное, что здесь происходит, — даты: Prisma отдаёт `Date`, а DTO
 * описан `showcaseCardResponseSchema`, где дата — ISO-строка. Неявно полагаться
 * на `JSON.stringify` значило бы оставить в DTO тип, которого на проводе нет:
 * схема OpenAPI и тип службы разошлись бы, и расхождение всплыло бы в
 * сгенерированном клиенте.
 *
 * `scheduleInfo` скрывается, когда у карточки есть слоты (ADR-002:63): слоты
 * вытесняют свободный текст, и показывать оба расписания одной карточки значит
 * показать два разных ответа на один вопрос. Значение остаётся в базе — его
 * удаление отдельной миграцией после переходного периода.
 *
 * Контакты (`telegramUsername`) маппер не трогает: их скрытие — решение
 * вызывающего кода, и оно различается у каталога, личного кабинета и заявки.
 */
export function toShowcaseCardResponse(
  card: ShowcaseCardWithUser,
  stats?: ShowcaseCardStatsDto,
): ShowcaseCardResponseDto {
  const hasSlots = card.slots.length > 0;

  return {
    ...card,
    user: { ...card.user },
    slots: card.slots.map(toShowcaseSlotResponse),
    ...(hasSlots ? { scheduleInfo: null } : {}),
    bumpedAt: card.bumpedAt.toISOString(),
    expiresAt: card.expiresAt.toISOString(),
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
    ...(stats ? { stats } : {}),
  };
}
