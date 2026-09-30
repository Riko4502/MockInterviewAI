import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  buildDedupKey,
  type NotificationEvent,
  type NotificationEventType,
  notificationEventCategory,
  parseNotificationEvent,
} from "@packages/dto";
import {
  defaultLocale,
  locales,
  type RenderedNotification,
  renderNotification,
} from "@packages/i18n";

import {
  type Notification,
  NotificationType,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";

/**
 * Форма, в которой уведомление уходит клиенту.
 *
 * `title` и `message` намеренно остаются прежними ключами, а значением
 * становится отрендеренный текст: контракт SSE их не меняет, и список в
 * HTTP должен читаться так же. Поля `dedupKey`, `renderedLocale` и
 * `renderedTimezone` наружу не отдаются — это внутренний учёт рендера.
 */
export type NotificationWire = {
  id: string;
  userId: string;
  category: NotificationType;
  type: string;
  payload: unknown;
  title: string;
  message: string;
  actionUrl: string | null;
  readAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type NotificationsCachePage = {
  items: Notification[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/** Зона получателя без заданной зоны: UTC, а не зона рантайма. */
const FALLBACK_TIME_ZONE = "UTC";

const toWireNotification = (row: Notification): NotificationWire => {
  // NULL означает «ещё не отрендерено» (ADR-003:58). Ленивый пересчёт чинит это
  // до кэширования (ADR-003:88), поэтому сюда попадает лишь состояние, минувшее
  // ремонт: запись кэша, сделанная до появления рендера, или прямая вставка в БД.
  // Пустая строка в таком случае показалась бы пользователю, поэтому текст
  // дорисовывается тем же рендером — он дешёвый и не ходит в I/O.
  const rendered =
    row.renderedTitle !== null && row.renderedMessage !== null
      ? { title: row.renderedTitle, message: row.renderedMessage }
      : renderNotification(
          row.type,
          (row.payload ?? {}) as Record<string, unknown>,
          {
            locale: defaultLocale,
            timeZone: FALLBACK_TIME_ZONE,
          },
        );

  return {
    id: row.id,
    userId: row.userId,
    category: row.category,
    type: row.type,
    payload: row.payload,
    title: rendered.title,
    message: rendered.message,
    actionUrl: row.actionUrl,
    readAt: row.readAt,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

export type RenderSettings = { locale: string; timeZone: string };

/**
 * Приводит настройки читателя к тем, с которыми текст реально будет отрендерен.
 *
 * Это не косметика: `renderedLocale` и `renderedTimezone` записываются в
 * `Notification` и служат признаком устаревания рендера. Если записать
 * невалидную зону, рендер вернёт ISO-строку, но колонка будет утверждать, что
 * всё в порядке, и ленивый пересчёт станет писать в базу на каждом чтении.
 * Поэтому неизвестная зона и неизвестная локаль откатываются на запасные
 * значения, и повторная проверка увидит «актуально».
 */
export function resolveRenderSettings(
  recipient: { locale?: string | null; timezone?: string | null } | null,
): RenderSettings {
  const locale =
    recipient?.locale &&
    (locales as readonly string[]).includes(recipient.locale)
      ? recipient.locale
      : defaultLocale;

  const timeZone = isValidTimeZone(recipient?.timezone)
    ? (recipient?.timezone as string)
    : FALLBACK_TIME_ZONE;

  return { locale, timeZone };
}

function isValidTimeZone(timeZone: string | null | undefined): boolean {
  if (!timeZone) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone });

    return true;
  } catch {
    return false;
  }
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  private readonly cacheTtlSeconds = 60;

  private readonly notificationStreamMaxLength = 100;

  private readonly notificationStreamTtlSeconds = 7 * 24 * 60 * 60;

  private readonly redisRetryAttempts = 3;
  private readonly redisRetryDelayMs = 200;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getNotifications(
    userId: string,
    page = 1,
    limit = 20,
    category?: NotificationType,
  ) {
    const cacheKey = this.getNotificationsCacheKey(
      userId,
      page,
      limit,
      category,
    );

    const cached = await this.redis.get(cacheKey);

    if (cached) {
      const parsed = JSON.parse(cached) as NotificationsCachePage;

      return { ...parsed, items: parsed.items.map(toWireNotification) };
    }

    const skip = (page - 1) * limit;
    const where = {
      userId,
      deletedAt: null,
      ...(category ? { category } : {}),
    };

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),

      this.prisma.notification.count({
        where,
      }),
    ]);

    const items = await this.refreshStaleRenders(userId, notifications);

    const result = {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };

    // В кэш кладём строки как есть: renderedLocale и renderedTimezone нужны,
    // чтобы следующий запрос заметил смену языка или часового пояса читателя.
    await this.redis.set(
      cacheKey,
      JSON.stringify(result),
      this.cacheTtlSeconds,
    );

    return { ...result, items: items.map(toWireNotification) };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const cacheKey = this.getUnreadCountCacheKey(userId);

    const cached = await this.redis.get(cacheKey);

    if (cached !== null) {
      return {
        count: Number(cached),
      };
    }

    const count = await this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
        deletedAt: null,
      },
    });

    await this.redis.set(cacheKey, String(count), this.cacheTtlSeconds);

    return { count };
  }

  async markAllAsRead(userId: string): Promise<{ success: true }> {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
        deletedAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    await this.scheduleNotificationSync(userId);

    return {
      success: true,
    };
  }

  async markAsRead(userId: string, id: string): Promise<{ success: true }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        id,
        userId,
        deletedAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException("Notification not found");
    }

    void this.scheduleNotificationSync(userId);

    return {
      success: true,
    };
  }

  async markAsDeleted(userId: string, id: string): Promise<{ success: true }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        id,
        userId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException("Notification not found");
    }

    void this.scheduleNotificationSync(userId);

    return {
      success: true,
    };
  }

  /**
   * Пересчитывает кэш рендера уведомлений, чей текст был отрисован при других
   * настройках читателя (ADR-003:88).
   *
   * Вызывается на чтении, а не по расписанию. Кэш списка лежит в Redis и после
   * пересчёта инвалидируется, иначе читатель продолжил бы видеть старый текст
   * из кэша.
   */
  private async refreshStaleRenders(
    userId: string,
    notifications: Notification[],
  ): Promise<Notification[]> {
    const recipient = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true, timezone: true },
    });

    if (!recipient) {
      return notifications;
    }

    const settings = resolveRenderSettings(recipient);

    const stale = notifications.filter(
      (notification) =>
        notification.renderedLocale !== settings.locale ||
        notification.renderedTimezone !== settings.timeZone,
    );

    if (stale.length === 0) {
      return notifications;
    }

    const refreshed = await Promise.all(
      stale.map((notification) =>
        this.ensureRenderedLocale(notification, settings),
      ),
    );

    await this.invalidateCache(userId);

    const byId = new Map(
      refreshed.map((notification) => [notification.id, notification]),
    );

    return notifications.map(
      (notification) => byId.get(notification.id) ?? notification,
    );
  }

  async createNotification(params: {
    userId: string;
    type: NotificationEventType;
    payload: NotificationEvent["payload"];
    actionUrl?: string;
  }) {
    const event = parseNotificationEvent({
      type: params.type,
      payload: params.payload,
    });

    const recipient = await this.prisma.user.findUnique({
      where: { id: params.userId },
      select: { locale: true, timezone: true },
    });

    const settings = resolveRenderSettings(recipient);

    const rendered = this.renderFor(event, settings);

    const notification = await this.prisma.notification.upsert({
      where: { dedupKey: buildDedupKey(event, params.userId) },
      create: {
        userId: params.userId,
        category: notificationEventCategory[event.type],
        type: event.type,
        payload: event.payload,
        renderedTitle: rendered.title,
        renderedMessage: rendered.message,
        renderedLocale: settings.locale,
        renderedTimezone: settings.timeZone,
        actionUrl: params.actionUrl,
        dedupKey: buildDedupKey(event, params.userId),
      },
      // Повторная доставка не должна ни менять текст, ни двигать createdAt:
      // иначе одна и та же новость пересортировывалась бы в списке.
      update: {},
    });

    await this.invalidateCache(params.userId);

    // Контракт SSE не меняется: клиент ждёт title и message
    // (apps/web/src/features/notification-realtime/model/schemas.ts), поэтому
    // наружу отдаётся денормализованный кэш, а не payload.
    await this.publishNotificationEvent(params.userId, "notification.new", {
      id: notification.id,
      title: notification.renderedTitle,
      message: notification.renderedMessage,
      category: notification.category,
      actionUrl: notification.actionUrl,
      createdAt: notification.createdAt.toISOString(),
      read: notification.readAt !== null,
    });

    await this.publishUnreadCount(params.userId);

    return notification;
  }

  private renderFor(
    event: NotificationEvent,
    settings: RenderSettings,
  ): RenderedNotification {
    return renderNotification(event.type, event.payload, settings);
  }

  /**
   * Ленивый пересчёт кэша рендера (ADR-003:88).
   *
   * Текст сравнивается с текущими настройками читателя и пересчитывается на
   * месте, а не фоновой задачей: уведомление компактно, и перебор всей таблицы
   * стоил бы дороже пересчёта в момент чтения. Учитывается и таймзона, а не
   * только локаль, потому что один и тот же UTC-инстант в разных зонах
   * отображается по-разному.
   */
  private async ensureRenderedLocale(
    notification: Notification,
    settings: RenderSettings,
  ): Promise<Notification> {
    if (
      notification.renderedLocale === settings.locale &&
      notification.renderedTimezone === settings.timeZone
    ) {
      return notification;
    }

    const event = parseNotificationEvent({
      type: notification.type,
      payload: notification.payload as NotificationEvent["payload"],
    });

    const rendered = this.renderFor(event, settings);

    return this.prisma.notification.update({
      where: { id: notification.id },
      data: {
        renderedTitle: rendered.title,
        renderedMessage: rendered.message,
        renderedLocale: settings.locale,
        renderedTimezone: settings.timeZone,
      },
    });
  }

  private async scheduleNotificationSync(userId: string): Promise<void> {
    await this.retryRedisOperation(async () => {
      await this.invalidateCache(userId);
      await this.publishUnreadCount(userId);
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Failed to sync notification state for user ${userId}: ${message}`,
      );
    });
  }

  private async retryRedisOperation(
    operation: () => Promise<void>,
  ): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.redisRetryAttempts; attempt += 1) {
      try {
        await operation();
        return;
      } catch (error) {
        lastError = error;

        if (attempt < this.redisRetryAttempts) {
          await this.delay(this.redisRetryDelayMs * attempt);
        }
      }
    }

    throw lastError;
  }

  private async delay(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }

  private async publishUnreadCount(userId: string): Promise<void> {
    const { count } = await this.getUnreadCount(userId);

    await this.publishNotificationEvent(userId, "notification.badge", {
      unreadCount: count,
    });
  }

  private async publishNotificationEvent(
    userId: string,
    type: string,
    data: unknown,
  ): Promise<void> {
    await this.redis.xadd(
      this.getNotificationStreamKey(userId),
      type,
      data,
      this.notificationStreamMaxLength,
      this.notificationStreamTtlSeconds,
      new Date().toISOString(),
    );
  }

  private async invalidateCache(userId: string): Promise<void> {
    const notificationKeys = await this.redis.scanKeys(
      `notifications:${userId}:page:*`,
    );

    await Promise.all([
      ...notificationKeys.map((key) => this.redis.delete(key)),
      this.redis.delete(this.getUnreadCountCacheKey(userId)),
    ]);
  }

  private getNotificationsCacheKey(
    userId: string,
    page: number,
    limit: number,
    category?: NotificationType,
  ): string {
    return `notifications:${userId}:page:${page}:limit:${limit}${category ? `:category:${category}` : ""}`;
  }

  private getUnreadCountCacheKey(userId: string): string {
    return `notifications:${userId}:unread-count`;
  }

  private getNotificationStreamKey(userId: string): string {
    return `user:${userId}:notifications`;
  }
}
