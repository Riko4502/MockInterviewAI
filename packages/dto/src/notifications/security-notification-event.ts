import { z } from "zod";

import {
  type NotificationEvent,
  notificationEventSchema,
} from "./notification-event";

/**
 * Словарь push-событий безопасности (ADR-005).
 *
 * Отдельный от `notificationEventSchema` намеренно. ADR-005:74 запрещает
 * смешивать security-события с доменными уведомлениями, и в модели
 * `Notification` им места нет — поэтому и словарь рендера отдельный, а не
 * ещё одно значение `NotificationType`. Общей остаётся только функция
 * `renderNotification` из `@packages/i18n`, чтобы тексты не разъезжались
 * между push и in-app (ADR-003:59).
 *
 * Идентификаторы — `<домен>.<событие>`, как в `notification-event.ts`.
 */

/**
 * Payload кода подтверждения отвязки Telegram (plan D6).
 *
 * Код — единственный секрет флоу (D5). В `security_events` он не пишется:
 * событие-носитель кода живёт только в этом сообщении очереди.
 */
export const securityTelegramUnlinkCodePayloadSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
  ttlMinutes: z.number().int().positive(),
});

/**
 * Payload события отвязки Telegram (D7).
 *
 * Только время: ip и user-agent в payload не попадают (ADR-003:83, ADR-005:128),
 * а «если это не вы» — это текст шаблона, а не данные события.
 */
export const securityTelegramUnlinkedPayloadSchema = z.object({
  occurredAt: z.iso.datetime(),
});

/** Payload события отвязки GitHub (D7). */
export const securityGithubUnlinkedPayloadSchema = z.object({
  occurredAt: z.iso.datetime(),
});

export const securityTelegramUnlinkCodeEventSchema = z.object({
  type: z.literal("security.telegram_unlink_code"),
  payload: securityTelegramUnlinkCodePayloadSchema,
});

export const securityTelegramUnlinkedEventSchema = z.object({
  type: z.literal("security.telegram_unlinked"),
  payload: securityTelegramUnlinkedPayloadSchema,
});

export const securityGithubUnlinkedEventSchema = z.object({
  type: z.literal("security.github_unlinked"),
  payload: securityGithubUnlinkedPayloadSchema,
});

/** Объединение известных security-событий, дискриминируется по `type`. */
export const securityNotificationEventSchema = z.discriminatedUnion("type", [
  securityTelegramUnlinkCodeEventSchema,
  securityTelegramUnlinkedEventSchema,
  securityGithubUnlinkedEventSchema,
]);

export type SecurityNotificationEvent = z.infer<
  typeof securityNotificationEventSchema
>;
export type SecurityNotificationEventType = SecurityNotificationEvent["type"];

export type SecurityTelegramUnlinkCodeEvent = z.infer<
  typeof securityTelegramUnlinkCodeEventSchema
>;
export type SecurityTelegramUnlinkedEvent = z.infer<
  typeof securityTelegramUnlinkedEventSchema
>;
export type SecurityGithubUnlinkedEvent = z.infer<
  typeof securityGithubUnlinkedEventSchema
>;

/**
 * Граница push-события: доменное уведомление или security-событие.
 *
 * Бот получает обе категории в одной очереди, поэтому валидация объединена:
 * неизвестный тип по-прежнему отбрасывается, а не отправляется получателю
 * как есть (граница доверия в `push-consumer.ts`).
 */
export const pushEventSchema = z.union([
  notificationEventSchema,
  securityNotificationEventSchema,
]);

export type PushEvent = NotificationEvent | SecurityNotificationEvent;

export function parsePushEvent(input: unknown): PushEvent {
  return pushEventSchema.parse(input);
}
