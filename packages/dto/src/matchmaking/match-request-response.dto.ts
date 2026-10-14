import { z } from "zod";
import { matchRequestStatusEnum } from "../showcase/showcase.enums";
import {
  paginatedResponseSchema,
  publicUserCardSchema,
  showcaseCardResponseSchema,
} from "../showcase/showcase-response.dto";
import { showcaseSlotResponseSchema } from "../showcase/showcase-slot.dto";

/**
 * [Response] Ответ сервера с полными данными заявки на собеседование.
 *
 * Примечание по названию:
 * `MatchRequest` — это название бизнес-сущности («Заявка на собеседование»),
 * а не технический HTTP-запрос. `ResponseDto` указывает, что это ответ сервера.
 *
 * Включает сразу данные самой заявки, публичные визитки обоих участников (sender/receiver)
 * и связанные карточки витрины (targetCard/senderCard). Это позволяет фронтенду отобразить
 * карточку отклика в интерфейсе за один сетевой запрос без водопада дополнительных запросов.
 */
export const matchRequestResponseSchema = z.object({
  id: z.uuid(),

  senderId: z.uuid(),
  receiverId: z.uuid(),
  sender: publicUserCardSchema,
  receiver: publicUserCardSchema,

  /** Карточка витрины, на которую отправлен отклик. */
  targetCard: showcaseCardResponseSchema,
  /** Прикреплённая карточка автора отклика (если указана). */
  senderCard: showcaseCardResponseSchema.nullable(),
  /** Слот, который заявка занимает или заняла; null у заявок без расписания. */
  slot: showcaseSlotResponseSchema.nullable(),
  /** Сессия интервью, созданная при принятии заявки со слотом (ADR-002:62). */
  sessionId: z.uuid().nullable(),
  /** Статус созданной сессии интервью (ветка dev: dashboard и показ витрины). */
  sessionStatus: z.enum(["CREATED", "ACTIVE", "CLOSED"]).nullable(),

  // Статус заявки и сообщения участников
  status: matchRequestStatusEnum,
  /** Сопроводительное сообщение инициатора. */
  message: z.string().nullable(),
  /** Желаемая тема мок-интервью. */
  preferredTopic: z.string().nullable(),
  /** Причина отклонения (заполняется при REJECTED). */
  rejectReason: z.string().nullable(),

  // Временные метки
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  /** Срок жизни заявки (72 часа с момента создания). */
  expiresAt: z.iso.datetime(),
});

export type MatchRequestResponseDto = z.infer<
  typeof matchRequestResponseSchema
>;

/** Статус сессии интервью, привязанной к принятой заявке. */
export type SessionStatus = "CREATED" | "ACTIVE" | "CLOSED";

/** [Response] Пагинированный список заявок (GET /matchmaking/requests/*). */
export const paginatedMatchRequestsSchema = paginatedResponseSchema(
  matchRequestResponseSchema,
);

export type PaginatedMatchRequestsDto = z.infer<
  typeof paginatedMatchRequestsSchema
>;

/**
 * [Response] Счётчик входящих заявок в статусе PENDING (ожидают ответа).
 * Легковесный ответ для бейджа в шапке сайта и колокольчика уведомлений.
 */
export const unreadMatchRequestsCountSchema = z.object({
  pendingCount: z.number().int().nonnegative(),
});

export type UnreadMatchRequestsCountDto = z.infer<
  typeof unreadMatchRequestsCountSchema
>;
