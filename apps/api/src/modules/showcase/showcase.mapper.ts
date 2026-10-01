import type {
  ShowcaseCardResponseDto,
  ShowcaseCardStatsDto,
} from "@packages/dto";

import type { Prisma } from "../../generated/prisma/client";
import { PUBLIC_USER_SELECT } from "./showcase.constants";

/**
 * Карточка витрины вместе с публичной визиткой автора.
 *
 * Это результат всех чтений, которые попадают в ответ: `user` выбирается
 * ровно одним способом, `PUBLIC_USER_SELECT`, поэтому и форма, и DTO
 * совпадают по построению, а не по проверке в рантайме.
 */
export type ShowcaseCardWithUser = Prisma.ShowcaseCardGetPayload<{
  include: { user: { select: typeof PUBLIC_USER_SELECT } };
}>;

/**
 * Приводит запись Prisma к `ShowcaseCardResponseDto`.
 *
 * Единственное, что здесь происходит, — даты: Prisma отдаёт `Date`, а DTO
 * описан `showcaseCardResponseSchema`, где дата — ISO-строка. Неявно полагаться
 * на `JSON.stringify` значило бы оставить в DTO тип, которого на проводе нет:
 * схема OpenAPI и тип службы разошлись бы, и расхождение всплыло бы в
 * сгенерированном клиенте.
 *
 * Контакты (`telegramUsername`) маппер не трогает: их скрытие — решение
 * вызывающего кода, и оно различается у каталога, личного кабинета и заявки.
 */
export function toShowcaseCardResponse(
  card: ShowcaseCardWithUser,
  stats?: ShowcaseCardStatsDto,
): ShowcaseCardResponseDto {
  return {
    ...card,
    user: { ...card.user },
    bumpedAt: card.bumpedAt.toISOString(),
    expiresAt: card.expiresAt.toISOString(),
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
    ...(stats ? { stats } : {}),
  };
}
