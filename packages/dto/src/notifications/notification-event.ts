import { z } from "zod";

/**
 * Словарь типов доменных событий и payload'ов (ADR-003:51, :56-57).
 *
 * Словарь общий для `apps/api` и `apps/telegram-bot`: бот получает
 * `type` + `payload` + `locale` и рендерит текст сам, поэтому и in-app,
 * и Telegram читают одну и ту же пару (ADR-003:59).
 *
 * Идентификаторы строятся как `<домен>.<событие>`. Домен соответствует
 * источнику события: ADR-002 — интервью и расписание, ADR-005 — безопасность.
 */

/**
 * Политика хранения payload (ADR-003:78-84).
 *
 * Payload — сохраняемая запись, а не одноразовое сообщение, поэтому в нём
 * лежат только поля, предназначенные для показа получателю. Валидация
 * выполняется Zod-схемой типа события, и она не просто проверяет, а
 * отбрасывает лишние поля: это защита от случайной утечки при добавлении
 * нового поля в будущем.
 *
 * Запрещены и потому не описаны ни в одной схеме: email, `telegramChatId`,
 * `githubId`, ip и user-agent (ADR-003:83).
 */

/**
 * Payload приветствия. Без идентификаторов сущностей: событие о самом факте.
 *
 * Пустой не из-за недосмотра, а по двум причинам. Приветствие пишется в той же
 * транзакции, что и регистрация, когда у пользователя ещё нет `displayName`, а
 * подставить email нельзя: ADR-003:83 запрещает контактные данные в payload.
 * Поэтому текст общий, без обращения по имени.
 */
export const systemWelcomePayloadSchema = z.object({});

/**
 * Payload предложения слота (ADR-003:57).
 *
 * Идентификатор заявки, а не сессии: предложение возникает до `accept`, и
 * сессии на этом шаге ещё не существует (ADR-002:62). Ссылка на сессию
 * появляется в следующем событии — `interview.slot_booked`.
 *
 * `proposedStartUtc` — обязательный UTC-инстант: без него рендер в зоне
 * читателя невозможен (ADR-002:55).
 */
export const interviewMatchProposedPayloadSchema = z.object({
  requestId: z.uuid(),
  proposedSlotId: z.uuid(),
  proposedStartUtc: z.iso.datetime(),
  senderName: z.string().min(1),
});

/** Payload подтверждённой брони: слот уже занят, время известно точно. */
export const interviewSlotBookedPayloadSchema = z.object({
  sessionId: z.uuid(),
  slotId: z.uuid(),
  startUtc: z.iso.datetime(),
  otherParticipantName: z.string().min(1),
});

/** Payload получения заявки на интервью (в т.ч. без слота). */
export const interviewMatchRequestReceivedPayloadSchema = z.object({
  requestId: z.uuid(),
  senderName: z.string().min(1),
});

/** Payload напоминания за 15 минут до начала сессии. */
export const interviewReminder15mPayloadSchema = z.object({
  sessionId: z.uuid(),
  startUtc: z.iso.datetime(),
  otherParticipantName: z.string().min(1),
});

/** Payload уведомления о том, что напарник вошёл в комнату. */
export const interviewPartnerJoinedPayloadSchema = z.object({
  sessionId: z.uuid(),
  partnerName: z.string().min(1),
});

export const systemWelcomeEventSchema = z.object({
  type: z.literal("system.welcome"),
  payload: systemWelcomePayloadSchema,
});

export const interviewMatchProposedEventSchema = z.object({
  type: z.literal("interview.match_proposed"),
  payload: interviewMatchProposedPayloadSchema,
});

export const interviewSlotBookedEventSchema = z.object({
  type: z.literal("interview.slot_booked"),
  payload: interviewSlotBookedPayloadSchema,
});

export const interviewMatchRequestReceivedEventSchema = z.object({
  type: z.literal("interview.match_request_received"),
  payload: interviewMatchRequestReceivedPayloadSchema,
});

export const interviewReminder15mEventSchema = z.object({
  type: z.literal("interview.reminder_15m"),
  payload: interviewReminder15mPayloadSchema,
});

export const interviewPartnerJoinedEventSchema = z.object({
  type: z.literal("interview.partner_joined"),
  payload: interviewPartnerJoinedPayloadSchema,
});

/**
 * Объединение всех известных типов событий.
 *
 * Дискриминируется по `type`, поэтому `payload` сужается до схемы своего
 * события, а добавление нового типа — это добавление одной ветви.
 */
export const notificationEventSchema = z.discriminatedUnion("type", [
  systemWelcomeEventSchema,
  interviewMatchProposedEventSchema,
  interviewSlotBookedEventSchema,
  interviewMatchRequestReceivedEventSchema,
  interviewReminder15mEventSchema,
  interviewPartnerJoinedEventSchema,
]);

export type NotificationEvent = z.infer<typeof notificationEventSchema>;
export type NotificationEventType = NotificationEvent["type"];

export type SystemWelcomeEvent = z.infer<typeof systemWelcomeEventSchema>;
export type InterviewMatchProposedEvent = z.infer<
  typeof interviewMatchProposedEventSchema
>;
export type InterviewSlotBookedEvent = z.infer<
  typeof interviewSlotBookedEventSchema
>;
export type InterviewMatchRequestReceivedEvent = z.infer<
  typeof interviewMatchRequestReceivedEventSchema
>;
export type InterviewReminder15mEvent = z.infer<
  typeof interviewReminder15mEventSchema
>;
export type InterviewPartnerJoinedEvent = z.infer<
  typeof interviewPartnerJoinedEventSchema
>;

export type NotificationEventPayloads = {
  "system.welcome": z.infer<typeof systemWelcomePayloadSchema>;
  "interview.match_proposed": z.infer<
    typeof interviewMatchProposedPayloadSchema
  >;
  "interview.slot_booked": z.infer<typeof interviewSlotBookedPayloadSchema>;
  "interview.match_request_received": z.infer<
    typeof interviewMatchRequestReceivedPayloadSchema
  >;
  "interview.reminder_15m": z.infer<typeof interviewReminder15mPayloadSchema>;
  "interview.partner_joined": z.infer<
    typeof interviewPartnerJoinedPayloadSchema
  >;
};

/**
 * Канал-агрегат для фильтрации в UI (ADR-003:61).
 *
 * `NotificationType` — перечисление БД, и новых значений для security-событий
 * в него не добавляется: у них отдельная модель (ADR-005).
 */
export const notificationEventCategory = {
  "system.welcome": "SYSTEM",
  "interview.match_proposed": "INTERVIEW",
  "interview.slot_booked": "INTERVIEW",
  "interview.match_request_received": "INTERVIEW",
  "interview.reminder_15m": "INTERVIEW",
  "interview.partner_joined": "INTERVIEW",
} as const satisfies Record<NotificationEventType, "SYSTEM" | "INTERVIEW">;

export type NotificationEventCategory =
  (typeof notificationEventCategory)[NotificationEventType];

/**
 * Граница публикации: валидирует событие и отбрасывает лишние поля payload
 * (ADR-003:51, :84).
 *
 * Возвращает уже очищенное событие, а не мутирует вход: неразобранное
 * значение до outbox доходить не должно.
 */
export function parseNotificationEvent(input: unknown): NotificationEvent {
  return notificationEventSchema.parse(input);
}

/**
 * Ключ идемпотентности записи (ADR-003:60, :76).
 *
 * Транспорт доставки — at-least-once, поэтому повторная доставка возможна, и
 * без ключа релей создал бы второй колокольчик из одного события.
 *
 * Идентичность задаётся по типу события явно, а не перечислением запрещённых
 * полей: отображаемые имена в неё не входят намеренно, иначе переименование
 * пользователя породило бы дубли. Явная карта также означает, что новое
 * событие обязано объявить свою идентичность, а не молча унаследовать
 * поведение чужого.
 */
const eventIdentity = {
  "system.welcome": () => "",
  "interview.match_proposed": (payload: {
    requestId: string;
    proposedSlotId: string;
    proposedStartUtc: string;
  }) =>
    `request=${payload.requestId}&slot=${payload.proposedSlotId}&start=${payload.proposedStartUtc}`,
  "interview.slot_booked": (payload: {
    sessionId: string;
    slotId: string;
    startUtc: string;
  }) =>
    `session=${payload.sessionId}&slot=${payload.slotId}&start=${payload.startUtc}`,
  "interview.match_request_received": (payload: { requestId: string }) =>
    `request=${payload.requestId}`,
  "interview.reminder_15m": (payload: {
    sessionId: string;
    startUtc: string;
  }) => `session=${payload.sessionId}&start=${payload.startUtc}`,
  "interview.partner_joined": (payload: { sessionId: string }) =>
    `session=${payload.sessionId}`,
} satisfies Record<NotificationEventType, (payload: never) => string>;

export function buildDedupKey(
  event: NotificationEvent,
  recipientId: string,
): string {
  const identity = eventIdentity[event.type] as (
    payload: NotificationEvent["payload"],
  ) => string;

  return `${event.type}:${recipientId}:${identity(event.payload)}`;
}
