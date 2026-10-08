import { parseNotificationEvent } from "@packages/dto";
import { renderNotification } from "@packages/i18n";
import { GrammyError } from "grammy";

import { resolveLocale, t } from "../i18n";

/**
 * Конверт push-уведомления (ADR-004:129).
 *
 * Конверт разбирает и переиспользует продюсер в `apps/api`
 * (`telegram-notification.channel.ts`): тот же контракт в обоих направлениях
 * важен для дедупликации — иначе бот не смог бы сопоставить повторную
 * публикацию с уже доставленным сообщением.
 *
 * `chatId` не входит в payload события намеренно: это адрес доставки, а не
 * данные уведомления (ADR-003:83).
 */
export interface PushEnvelope {
  event: unknown;
  chatId: string;
  locale: string;
  timeZone: string;
  actionUrl?: string;
}

/** Задержки повторов: 1/2/4/8/16 секунд (ADR-004:115). */
export const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000] as const;

/**
 * Сколько раз сообщение попадёт в Telegram: первая попытка плюс пять повторов.
 *
 * ADR перечисляет пять задержек (1/2/4/8/16 с), поэтому список использован
 * целиком: последний повтор — это и есть пятая задержка, а шестая доставка
 * уже идёт в DLQ.
 */
export const MAX_DELIVERIES = RETRY_DELAYS_MS.length + 1;

/** TTL сообщений в DLQ — 7 дней (ADR-004:117). */
export const DLQ_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Заголовок AMQP со счётчиком уже выполненных повторов. */
export const RETRY_HEADER = "x-push-retry";

/** Заголовок с причиной ухода в DLQ — для разбора оператором. */
export const DEAD_LETTER_REASON_HEADER = "x-push-dead-letter-reason";

/** Сколько `messageId` помним, чтобы не отправить одно уведомление дважды. */
const DEDUP_CAPACITY = 10_000;

/** Сколько живёт запись дедупликации: заведомо больше окна повторов. */
const DEDUP_TTL_MS = 10 * 60 * 1000;

export type TelegramFailureKind = "retryable" | "permanent";

export interface TelegramFailure {
  kind: TelegramFailureKind;
  description: string;
  /** Для 429: сколько ждать по требованию Telegram. */
  retryAfterMs?: number;
}

/**
 * Описания ошибок Telegram, после которых повтор бессмысленен.
 *
 * Проверка идёт по тексту описания, а не только по коду: `400 chat not found`
 * и `400 message is not modified` — один код, но только первое означает
 * недостижимого адресата. Коды `403`/`401` невосстановимы в любом случае:
 * бот заблокирован или токен отозван, и повтор их не исправит.
 */
const PERMANENT_MARKERS = [
  "bot was blocked by the user",
  "bot was kicked",
  "user is deactivated",
  "bot can't initiate conversation",
  "bot can't send messages",
  "chat not found",
  "user not found",
  "chat is not available",
  "have no rights to send a message",
];

/**
 * Классифицирует ошибку Telegram Bot API: повторять или отправлять в DLQ
 * (ADR-004:119).
 *
 * Невосстановимые адресатные ошибки уходят в DLQ сразу, не расходуя попытки:
 * иначе пять повторов занимают полминуты ради заведомо нулевого результата.
 * Всё, что не распознано, считается временным — ложный DLQ хуже лишнего
 * повтора, потому что сообщение теряется без возможности разбора.
 *
 * @param err - Ошибка grammY или транспорта.
 * @returns Вид ошибки, её описание и, для 429, задержку от Telegram.
 */
export function classifyTelegramError(err: unknown): TelegramFailure {
  if (!(err instanceof GrammyError)) {
    const description = err instanceof Error ? err.message : String(err);
    return { kind: "retryable", description };
  }

  const code = err.error_code;
  const description = err.description;

  if (code === 429) {
    const retryAfter = err.parameters?.retry_after;
    return typeof retryAfter === "number"
      ? {
          kind: "retryable",
          description,
          retryAfterMs: retryAfter * 1000,
        }
      : { kind: "retryable", description };
  }

  const normalized = description.toLowerCase();
  if (PERMANENT_MARKERS.some((marker) => normalized.includes(marker))) {
    return { kind: "permanent", description };
  }

  // `400` — некорректный запрос (пустой текст, невалидный `chat_id`),
  // `401` — отозванный токен, `403` — бот заблокирован, `409` — конфликт
  // Telegram. Ни один из них не исчезает от повтора: повтор лишь занимает
  // слот prefetch на полминуты и уводит сообщение в DLQ с той же причиной.
  if (code === 400 || code === 401 || code === 403 || code === 409) {
    return { kind: "permanent", description };
  }

  return { kind: "retryable", description };
}

/** Номер повтора из заголовков сообщения; отсутствует — это первая доставка. */
export function readRetryCount(headers: Record<string, unknown> = {}): number {
  const raw = headers[RETRY_HEADER];
  const value = typeof raw === "number" ? raw : Number.NaN;
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

/**
 * Ограниченное по памяти множество уже доставленных `messageId`.
 *
 * Транспорт at-least-once: подтверждение брокера может потеряться, и сообщение
 * вернётся повторно. Полное хранилище доставок в бот не переносится — вместо
 * него окно в несколько минут, заведомо перекрывающее весь цикл повторов.
 * `Map` сохраняет порядок вставки, поэтому вытеснение идёт с самых старых
 * записей без отдельной структуры.
 *
 * Отметка о доставке ставится **после** успешной отправки (`begin` → `complete`).
 * Пометить её заранее нельзя: сообщение, ушедшее в очередь повтора или в DLQ,
 * возвращается с тем же `messageId`, и предварительная отметка навсегда
 * погасила бы его повтор — уведомление просто исчезло бы без попытки.
 * Пока отправка идёт, `messageId` числится в `inFlight`: дубликат, доставленный
 * параллельно при `prefetch > 1`, тоже ждёт, а не отправляется вторым.
 */
export class DeduplicationCache {
  private readonly seen = new Map<string, number>();
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly capacity: number = DEDUP_CAPACITY,
    private readonly ttlMs: number = DEDUP_TTL_MS,
  ) {}

  /**
   * Забирает `messageId` в обработку.
   *
   * @returns `false`, если сообщение уже доставлялось в пределах окна или
   *   прямо сейчас доставляется — такое лучше пропустить, чем отправить дважды.
   */
  begin(messageId: string, now: number = Date.now()): boolean {
    const rememberedAt = this.seen.get(messageId);
    if (rememberedAt !== undefined && now - rememberedAt < this.ttlMs) {
      return false;
    }
    if (this.inFlight.has(messageId)) return false;

    this.inFlight.add(messageId);
    return true;
  }

  /** Помечает доставку: только после этого `messageId` считается отправленным. */
  complete(messageId: string, now: number = Date.now()): void {
    this.inFlight.delete(messageId);
    // Повторная вставка нужна, чтобы запись встала в конец порядка вставки:
    // `Map.set` для существующего ключа позицию не меняет, и вытеснение рано
    // или поздно начало бы выбрасывать свежие записи вместо старых.
    this.seen.delete(messageId);
    this.seen.set(messageId, now);
    this.evict(now);
  }

  /** Освобождает незавершённую обработку: повтор должен получить шанс. */
  release(messageId: string): void {
    this.inFlight.delete(messageId);
  }

  /** Чистка истёкших записей и вытеснение самых старых при переполнении. */
  private evict(now: number): void {
    for (const [key, at] of this.seen) {
      if (now - at < this.ttlMs) break;
      this.seen.delete(key);
    }

    while (this.seen.size > this.capacity) {
      const oldest = this.seen.keys().next();
      if (oldest.done === true) return;
      this.seen.delete(oldest.value);
    }
  }
}

export interface RenderedPush {
  text: string;
  locale: "ru" | "en";
  actionUrl?: string;
}

/**
 * Превращает конверт в текст сообщения и ссылку кнопки (ADR-003:59).
 *
 * Текст собирает `renderNotification` из `@packages/i18n` — тот же рендер,
 * которым пользуется in-app-путь, поэтому тексты не разъезжаются.
 *
 * `parseNotificationEvent` здесь — граница доверия: сообщение в очереди
 * чужой процесс, и неизвестный тип события или лишние поля payload'а должны
 * приводить к отказу, а не к отправке как есть.
 *
 * @param envelope - Конверт из очереди.
 * @param webAppUrl - Значение `WEB_APP_URL` для абсолютной ссылки.
 * @throws Ошибка Zod, если конверт не проходит схему события.
 */
export function renderPush(
  envelope: PushEnvelope,
  webAppUrl: string,
): RenderedPush {
  const event = parseNotificationEvent(envelope.event);
  const locale = resolveLocale(undefined, envelope.locale, undefined);
  const { title, message } = renderNotification(event.type, event.payload, {
    locale,
    timeZone: envelope.timeZone,
  });

  // parse_mode не включается: в текст подставляются имена пользователей
  // (`senderName`), и HTML-разметка в имени стала бы либо ошибкой Telegram,
  // либо возможностью внедрить форматирование в уведомление.
  const text = `${title}\n\n${message}`;

  const actionUrl = normalizeActionUrl(envelope.actionUrl, webAppUrl);

  return actionUrl === undefined
    ? { text, locale }
    : { text, locale, actionUrl };
}

/**
 * Делает ссылку из относительного `actionUrl` абсолютной.
 *
 * Отсутствующая или внешняя ссылка отбрасывается: бот строит кнопку из
 * значения, пришедшего в очереди, и абсолютный URL оттуда — это вектор
 * подмены ссылки в уведомлении.
 */
export function normalizeActionUrl(
  actionUrl: string | undefined,
  webAppUrl: string,
): string | undefined {
  if (actionUrl === undefined || actionUrl === "") return undefined;
  if (/^https?:\/\//i.test(actionUrl)) return undefined;

  const base = webAppUrl.endsWith("/") ? webAppUrl : `${webAppUrl}/`;
  return new URL(actionUrl.replace(/^\//, ""), base).toString();
}

/** Подпись кнопки перехода из push-уведомления. */
export function pushButtonLabel(locale: "ru" | "en"): string {
  return t(locale, "push.openButton");
}
