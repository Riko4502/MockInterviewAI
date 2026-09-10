import { Injectable, NotFoundException } from "@nestjs/common";

import { NotificationType } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";

@Injectable()
export class NotificationsService {
  private readonly cacheTtlSeconds = 60;

  private readonly notificationStreamMaxLength = 100;

  private readonly notificationStreamTtlSeconds = 7 * 24 * 60 * 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getNotifications(userId: string, page = 1, limit = 20) {
    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const cacheKey = this.getNotificationsCacheKey(userId, safePage, safeLimit);

    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const skip = (safePage - 1) * safeLimit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: {
          userId,
          deletedAt: null,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: safeLimit,
      }),

      this.prisma.notification.count({
        where: {
          userId,
          deletedAt: null,
        },
      }),
    ]);

    const result = {
      items: notifications,
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    };

    await this.redis.set(
      cacheKey,
      JSON.stringify(result),
      this.cacheTtlSeconds,
    );

    return result;
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

    await this.invalidateCache(userId);

    await this.publishUnreadCount(userId);

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

    await this.invalidateCache(userId);

    await this.publishUnreadCount(userId);

    return {
      success: true,
    };
  }

  async createNotification(params: {
    userId: string;
    category: NotificationType;
    title: string;
    message: string;
    actionUrl?: string;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        category: params.category,
        title: params.title,
        message: params.message,
        actionUrl: params.actionUrl,
      },
    });

    await this.invalidateCache(params.userId);

    await this.publishNotificationEvent(params.userId, "notification.new", {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      category: notification.category,
      actionUrl: notification.actionUrl,
    });

    await this.publishUnreadCount(params.userId);

    return notification;
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
  ): string {
    return `notifications:${userId}:page:${page}:limit:${limit}`;
  }

  private getUnreadCountCacheKey(userId: string): string {
    return `notifications:${userId}:unread-count`;
  }

  private getNotificationStreamKey(userId: string): string {
    return `user:${userId}:notifications`;
  }
}
