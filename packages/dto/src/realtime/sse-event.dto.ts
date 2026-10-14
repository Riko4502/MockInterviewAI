import { z } from "zod";
import { notificationTypeSchema } from "../notifications/notification.dto";

/**
 * Словарь SSE-событий глобального потока уведомлений (ADR-004:86).
 *
 * До появления этого словаря имена событий существовали в шести несвязанных
 * местах: константы Go (`apps/realtime/internal/sse/event.go`), сырые строки в
 * `apps/api`, литералы в `scripts/send-sse.mjs` и три копии таблицы в
 * документации. Компилятором они не были связаны, поэтому опечатка в имени
 * события проходила незамеченной: `apps/realtime` передаёт `payload` как
 * `json.RawMessage` и не проверяет имя события.
 *
 * Источник правды — этот файл. Из него генерируется Go-файл с константами
 * (`packages/dto/scripts/generate-go-sse-events.ts`), он коммитится в
 * `apps/realtime/internal/sse/events_gen.go`, и CI падает, если сгенерированный
 * файл разошёлся с этим словарём.
 *
 * Имена событий — `<домен>.<событие>`, как в словаре доменных событий
 * (`notifications/notification-event.ts`). Это независимые словари: доменное
 * событие описывает факт («предложен слот»), SSE-событие — кадр в потоке
 * («появилось уведомление в колокольчике»).
 */

/**
 * Визуальная severity отрисовки (ADR-004:87).
 *
 * До переименования это поле называлось `category`, и в `apps/realtime`
 * объявлялось как `NotificationCategory` со значениями `info | success |
 * warning | error`. Одновременно по проводу в `category` уходил
 * `NotificationType` из БД (`SYSTEM | INTERVIEW | MESSAGE`). Словари не
 * пересекались, поэтому слово означало разное в зависимости от слоя, а
 * проверки не было ни на одной стороне.
 *
 * Теперь визуальная severity живёт в поле `severity`, а `category` означает
 * только доменный `NotificationType` — то же значение, что в REST-DTO
 * уведомления и в БД.
 *
 * Поле необязательное: сейчас ни один продюсер его не заполняет, клиент
 * иконку выбирает по `category` из REST-DTO. Обязательным оно станет вместе с
 * первым продюсером, который начнёт его писать.
 */
export const sseSeveritySchema = z.enum([
  "info",
  "success",
  "warning",
  "error",
]);

export type SseSeverity = z.infer<typeof sseSeveritySchema>;

/** Payload кадра `notification.new`: персональное уведомление. */
export const notificationNewPayloadSchema = z.object({
  id: z.string().min(1),
  /** Доменный тип уведомления из БД, а не визуальная severity. */
  category: notificationTypeSchema,
  severity: sseSeveritySchema.optional(),
  title: z.string(),
  message: z.string(),
  actionUrl: z.string().nullish(),
  createdAt: z.iso.datetime(),
  read: z.boolean(),
});

/** Payload кадра `notification.badge`: счётчик непрочитанных. */
export const notificationBadgePayloadSchema = z.object({
  unreadCount: z.number().int().nonnegative(),
});

/** Payload кадра `session.invited`: приглашение в комнату собеседования. */
export const sessionInvitedPayloadSchema = z.object({
  sessionId: z.string().min(1),
  sessionTitle: z.string(),
  inviterName: z.string(),
  role: z.string(),
  joinUrl: z.string(),
  expiresAt: z.string(),
});

/** Payload кадра `code_runner.status`: результат прогона автотестов. */
export const codeRunnerStatusPayloadSchema = z.object({
  taskId: z.string().min(1),
  sessionId: z.string(),
  status: z.string(),
  passedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  executionTimeMs: z.number().int().nonnegative(),
});

/** Payload кадра `ai.report_ready`: готовность итогового отчёта. */
export const aiReportReadyPayloadSchema = z.object({
  sessionId: z.string().min(1),
  reportId: z.string().min(1),
  score: z.number(),
  summary: z.string(),
  reportUrl: z.string(),
});

/** Payload кадра `account.updated`: изменение баланса кредитов или тарифа. */
export const accountUpdatedPayloadSchema = z.object({
  remainingCredits: z.number(),
  plan: z.string(),
  reason: z.string().optional(),
});

const maintenanceWindowSchema = z.object({
  startsAt: z.string(),
  endsAt: z.string(),
});

/** Payload кадра `system.broadcast`: общесистемный алерт. */
export const systemBroadcastPayloadSchema = z.object({
  severity: sseSeveritySchema,
  message: z.string(),
  maintenanceWindow: maintenanceWindowSchema.optional(),
});

/** Payload кадра `auth.revoked`: причина разрыва потока. */
export const authRevokedPayloadSchema = z.object({
  reason: z.string(),
});

export type NotificationNewPayload = z.infer<
  typeof notificationNewPayloadSchema
>;
export type NotificationBadgePayload = z.infer<
  typeof notificationBadgePayloadSchema
>;
export type SessionInvitedPayload = z.infer<typeof sessionInvitedPayloadSchema>;
export type CodeRunnerStatusPayload = z.infer<
  typeof codeRunnerStatusPayloadSchema
>;
export type AIReportReadyPayload = z.infer<typeof aiReportReadyPayloadSchema>;
export type AccountUpdatedPayload = z.infer<typeof accountUpdatedPayloadSchema>;
export type SystemBroadcastPayload = z.infer<
  typeof systemBroadcastPayloadSchema
>;
export type AuthRevokedPayload = z.infer<typeof authRevokedPayloadSchema>;

/**
 * Полный перечень типов кадров глобального SSE-потока.
 *
 * Heartbeat (`ping`) в перечне нет намеренно: он не является событием, а
 * передаётся SSE-комментарием (`: ping <ts>`), которое парсер `EventSource`
 * игнорирует и которое не имеет ни `type`, ни `payload`. В таблице
 * `apps/realtime/SSE_SPEC.md` он был описан как событие — расхождение
 * устранено.
 */
export const sseEventTypes = [
  "notification.new",
  "notification.badge",
  "session.invited",
  "code_runner.status",
  "ai.report_ready",
  "account.updated",
  "system.broadcast",
  "auth.revoked",
] as const;

export type SseEventType = (typeof sseEventTypes)[number];

export const sseEventTypeSchema = z.enum(sseEventTypes);

/**
 * Описания событий — текст для документирования констант в Go.
 *
 * Отдельная карта, а не комментарии: генератор читает значение отсюда, поэтому
 * описание не может молча разъехаться с константой.
 */
export const sseEventDescriptions = {
  "notification.new": "содержит новое персональное уведомление пользователя",
  "notification.badge": "содержит обновление счётчика непрочитанных",
  "session.invited": "содержит приглашение пользователя на собеседование",
  "code_runner.status":
    "содержит статус асинхронного прогона автотестов кандидата",
  "ai.report_ready": "содержит уведомление о готовности AI-отчёта интервью",
  "account.updated": "содержит изменение баланса кредитов или тарифного плана",
  "system.broadcast":
    "содержит общесистемный алерт или анонс технических работ",
  "auth.revoked":
    "отправляется последним кадром перед разрывом потока при отзыве авторизации",
} as const satisfies Record<SseEventType, string>;

/** Схема payload'а по типу события. */
export const sseEventPayloadSchemas = {
  "notification.new": notificationNewPayloadSchema,
  "notification.badge": notificationBadgePayloadSchema,
  "session.invited": sessionInvitedPayloadSchema,
  "code_runner.status": codeRunnerStatusPayloadSchema,
  "ai.report_ready": aiReportReadyPayloadSchema,
  "account.updated": accountUpdatedPayloadSchema,
  "system.broadcast": systemBroadcastPayloadSchema,
  "auth.revoked": authRevokedPayloadSchema,
} as const satisfies Record<SseEventType, z.ZodType>;

/** Конверт кадра: имя события плюс его payload. */
const sseEnvelope = <TType extends SseEventType>(type: TType) =>
  z.object({
    type: z.literal(type),
    payload: sseEventPayloadSchemas[type],
  });

export const sseEventEnvelopeSchema = z.discriminatedUnion("type", [
  sseEnvelope("notification.new"),
  sseEnvelope("notification.badge"),
  sseEnvelope("session.invited"),
  sseEnvelope("code_runner.status"),
  sseEnvelope("ai.report_ready"),
  sseEnvelope("account.updated"),
  sseEnvelope("system.broadcast"),
  sseEnvelope("auth.revoked"),
]);

export type SseEventEnvelope = z.infer<typeof sseEventEnvelopeSchema>;

/** Payload конкретного типа события. */
export type SseEventPayloads = {
  [K in SseEventType]: z.infer<(typeof sseEventPayloadSchemas)[K]>;
};

/**
 * Граница публикации: проверяет payload перед записью в Redis Stream.
 *
 * Применяется продюсером, потому что `apps/realtime` имя события и payload не
 * проверяет — опечатка в типе или поле уехала бы в браузер как валидный кадр.
 *
 * Имя события проверяется тоже, хотя тип параметра это уже гарантирует:
 * сюда попадают строки извне (аргументы CLI, значение из конфигурации), и
 * `sseEventPayloadSchemas[type].safeParse` на неизвестном типе упал бы с
 * `TypeError` о несуществующем свойстве вместо внятной ошибки контракта.
 */
export function parseSseEventPayload(
  type: SseEventType,
  payload: unknown,
): SseEventPayloads[SseEventType] {
  const schema = sseEventPayloadSchemas[type];

  if (schema === undefined) {
    throw new Error(
      `SSE event "${type}" is not in the dictionary: ${sseEventTypes.join(", ")}`,
    );
  }

  const result = schema.safeParse(payload);

  if (!result.success) {
    throw new Error(
      `SSE payload of "${type}" does not match the dictionary: ${result.error.message}`,
    );
  }

  return result.data as SseEventPayloads[SseEventType];
}
