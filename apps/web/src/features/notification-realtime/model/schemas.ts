import {
  notificationBadgePayloadSchema,
  notificationNewPayloadSchema,
  type SseEventType,
} from "@packages/dto";
import { z } from "zod";

/**
 * Клиентская граница разбора SSE-кадров глобального потока.
 *
 * Схемы payload'ов берутся из общего словаря (`packages/dto`), а не
 * дублируются здесь: раньше имена событий и поля существовали в трёх
 * независимых местах, и опечатка в продюсере (`apps/api`) проходила
 * незамеченной, потому что `apps/realtime` передаёт `payload` как
 * `json.RawMessage` и не проверяет его.
 *
 * Отличается только строгость — клиент терпимее словаря, потому что поток
 * переигрывается: `apps/realtime` отдаёт историю по `Last-Event-ID`, а поток
 * хранится 7 дней, поэтому кадр, записанный до текущего продюсера, всё ещё
 * может прийти в браузер. Невалидные события в проде отбрасываются молча,
 * значит клиент не должен отвергать запись, которую он лишь переигрывает.
 */
const replayTolerantNewPayloadSchema = notificationNewPayloadSchema.extend({
  createdAt: z.iso.datetime().nullish(),
  read: z.boolean().nullish(),
  /**
   * `category` намеренно не проверяется доменным `NotificationType`: в
   * истории потока ещё лежат кадры, записанные до ADR-004:87, где в этом
   * поле была визуальная severity (`info | success | warning | error`).
   * Такие значения не совпадают с доменным типом, и строгая проверка молча
   * потеряла бы уведомления всем, у кого осталась непроигранная история.
   * Категорию клиент берёт из REST-DTO уведомления, а не из кадра.
   */
  category: z.string().nullish(),
});

export const newNotificationSchema = z.object({
  type: z.literal("notification.new"),
  payload: replayTolerantNewPayloadSchema,
});

export const badgeSchema = z.object({
  type: z.literal("notification.badge"),
  payload: notificationBadgePayloadSchema,
});

/**
 * Имена событий, на которые клиент подписан в потоке.
 *
 * `satisfies` — проверка на этапе компиляции: если событие исчезнет из
 * словаря или будет переименовано, сборка упадёт здесь, а не в проде, где
 * клиент молча перестанет получать кадры.
 */
export const notificationStreamEventTypes = [
  "notification.new",
  "notification.badge",
] as const satisfies readonly SseEventType[];

export type NotificationStreamEventType =
  (typeof notificationStreamEventTypes)[number];
