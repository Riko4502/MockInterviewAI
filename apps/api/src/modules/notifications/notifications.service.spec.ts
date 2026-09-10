import { NotFoundException } from "@nestjs/common";

import { NotificationType } from "../../generated/prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import type { RedisService } from "../../redis/redis.service";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  let prismaMock: {
    notification: {
      findMany: jest.Mock;
      count: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
  };

  let redisMock: {
    get: jest.Mock;
    set: jest.Mock;
    delete: jest.Mock;
    scanKeys: jest.Mock;
    xadd: jest.Mock;
  };

  let service: NotificationsService;

  const userId = "11111111-1111-4111-a111-111111111111";

  const notificationId = "22222222-2222-4222-a222-222222222222";

  const page = 1;
  const limit = 20;

  const notificationsCacheKey = `notifications:${userId}:page:${page}:limit:${limit}`;

  const notificationsCachePattern = `notifications:${userId}:page:*`;

  const unreadCountCacheKey = `notifications:${userId}:unread-count`;

  const notificationStreamKey = `user:${userId}:notifications`;

  const mockNotification = {
    id: notificationId,
    userId,
    category: NotificationType.INTERVIEW,
    title: "Новое уведомление",
    message: "Тестовое уведомление",
    actionUrl: "/interviews/123",
    readAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prismaMock = {
      notification: {
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
    };

    redisMock = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      scanKeys: jest.fn().mockResolvedValue([]),
      xadd: jest.fn(),
    };

    service = new NotificationsService(
      prismaMock as unknown as PrismaService,
      redisMock as unknown as RedisService,
    );
  });

  describe("getNotifications", () => {
    it("получает страницу уведомлений из БД и сохраняет результат в Redis при отсутствии кэша", async () => {
      redisMock.get.mockResolvedValue(null);

      prismaMock.notification.findMany.mockResolvedValue([mockNotification]);

      prismaMock.notification.count.mockResolvedValue(1);

      const result = await service.getNotifications(userId, page, limit);

      expect(redisMock.get).toHaveBeenCalledWith(notificationsCacheKey);

      expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          deletedAt: null,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: 0,
        take: 20,
      });

      expect(prismaMock.notification.count).toHaveBeenCalledWith({
        where: {
          userId,
          deletedAt: null,
        },
      });

      expect(redisMock.set).toHaveBeenCalledWith(
        notificationsCacheKey,
        JSON.stringify({
          items: [mockNotification],
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        }),
        60,
      );

      expect(result).toEqual({
        items: [mockNotification],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it("возвращает страницу уведомлений из Redis и не обращается к БД при наличии кэша", async () => {
      const cachedResult = {
        items: [
          {
            ...mockNotification,
            createdAt: mockNotification.createdAt.toISOString(),
            updatedAt: mockNotification.updatedAt.toISOString(),
          },
        ],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      };

      redisMock.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await service.getNotifications(userId, page, limit);

      expect(redisMock.get).toHaveBeenCalledWith(notificationsCacheKey);

      expect(prismaMock.notification.findMany).not.toHaveBeenCalled();

      expect(prismaMock.notification.count).not.toHaveBeenCalled();

      expect(redisMock.set).not.toHaveBeenCalled();

      expect(result).toEqual(cachedResult);
    });

    it("правильно рассчитывает skip для запрошенной страницы", async () => {
      redisMock.get.mockResolvedValue(null);

      prismaMock.notification.findMany.mockResolvedValue([]);
      prismaMock.notification.count.mockResolvedValue(45);

      const result = await service.getNotifications(userId, 2, 20);

      expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          deletedAt: null,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: 20,
        take: 20,
      });

      expect(result).toEqual({
        items: [],
        page: 2,
        limit: 20,
        total: 45,
        totalPages: 3,
      });
    });

    it("ограничивает limit значением 100", async () => {
      redisMock.get.mockResolvedValue(null);

      prismaMock.notification.findMany.mockResolvedValue([]);
      prismaMock.notification.count.mockResolvedValue(0);

      const result = await service.getNotifications(userId, 1, 500);

      expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          deletedAt: null,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: 0,
        take: 100,
      });

      expect(result).toEqual({
        items: [],
        page: 1,
        limit: 100,
        total: 0,
        totalPages: 0,
      });
    });
  });

  describe("getUnreadCount", () => {
    it("получает счетчик из БД и сохраняет его в Redis при отсутствии кэша", async () => {
      redisMock.get.mockResolvedValue(null);

      prismaMock.notification.count.mockResolvedValue(3);

      const result = await service.getUnreadCount(userId);

      expect(redisMock.get).toHaveBeenCalledWith(unreadCountCacheKey);

      expect(prismaMock.notification.count).toHaveBeenCalledWith({
        where: {
          userId,
          readAt: null,
          deletedAt: null,
        },
      });

      expect(redisMock.set).toHaveBeenCalledWith(unreadCountCacheKey, "3", 60);

      expect(result).toEqual({
        count: 3,
      });
    });

    it("возвращает счетчик из Redis и не обращается к БД при наличии кэша", async () => {
      redisMock.get.mockResolvedValue("4");

      const result = await service.getUnreadCount(userId);

      expect(redisMock.get).toHaveBeenCalledWith(unreadCountCacheKey);

      expect(prismaMock.notification.count).not.toHaveBeenCalled();

      expect(redisMock.set).not.toHaveBeenCalled();

      expect(result).toEqual({
        count: 4,
      });
    });
  });

  describe("markAsRead", () => {
    it("помечает уведомление прочитанным, инвалидирует кэш и публикует badge", async () => {
      prismaMock.notification.updateMany.mockResolvedValue({
        count: 1,
      });

      redisMock.scanKeys.mockResolvedValue([
        notificationsCacheKey,
        `notifications:${userId}:page:2:limit:20`,
      ]);

      redisMock.delete.mockResolvedValue(undefined);
      redisMock.get.mockResolvedValue(null);
      redisMock.set.mockResolvedValue(undefined);
      redisMock.xadd.mockResolvedValue("1724500000000-0");

      prismaMock.notification.count.mockResolvedValue(0);

      const result = await service.markAsRead(userId, notificationId);

      expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
        where: {
          id: notificationId,
          userId,
          deletedAt: null,
        },
        data: {
          readAt: expect.any(Date),
        },
      });

      expect(redisMock.scanKeys).toHaveBeenCalledWith(
        notificationsCachePattern,
      );

      expect(redisMock.delete).toHaveBeenCalledWith(notificationsCacheKey);

      expect(redisMock.delete).toHaveBeenCalledWith(
        `notifications:${userId}:page:2:limit:20`,
      );

      expect(redisMock.delete).toHaveBeenCalledWith(unreadCountCacheKey);

      expect(redisMock.xadd).toHaveBeenCalledWith(
        notificationStreamKey,
        "notification.badge",
        {
          unreadCount: 0,
        },
        100,
        604800,
      );

      expect(result).toEqual({
        success: true,
      });
    });

    it("выбрасывает NotFoundException если уведомление не найдено", async () => {
      prismaMock.notification.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(service.markAsRead(userId, notificationId)).rejects.toThrow(
        NotFoundException,
      );

      expect(redisMock.scanKeys).not.toHaveBeenCalled();

      expect(redisMock.delete).not.toHaveBeenCalled();
      expect(redisMock.xadd).not.toHaveBeenCalled();
    });
  });

  describe("markAsDeleted", () => {
    it("выполняет soft-delete, инвалидирует кэш и публикует badge", async () => {
      prismaMock.notification.updateMany.mockResolvedValue({
        count: 1,
      });

      redisMock.scanKeys.mockResolvedValue([notificationsCacheKey]);

      redisMock.delete.mockResolvedValue(undefined);
      redisMock.get.mockResolvedValue(null);
      redisMock.set.mockResolvedValue(undefined);
      redisMock.xadd.mockResolvedValue("1724500000000-0");

      prismaMock.notification.count.mockResolvedValue(0);

      const result = await service.markAsDeleted(userId, notificationId);

      expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
        where: {
          id: notificationId,
          userId,
          deletedAt: null,
        },
        data: {
          deletedAt: expect.any(Date),
        },
      });

      expect(redisMock.scanKeys).toHaveBeenCalledWith(
        notificationsCachePattern,
      );

      expect(redisMock.delete).toHaveBeenCalledWith(notificationsCacheKey);

      expect(redisMock.delete).toHaveBeenCalledWith(unreadCountCacheKey);

      expect(redisMock.xadd).toHaveBeenCalledWith(
        notificationStreamKey,
        "notification.badge",
        {
          unreadCount: 0,
        },
        100,
        604800,
      );

      expect(result).toEqual({
        success: true,
      });
    });

    it("выбрасывает NotFoundException если уведомление не найдено", async () => {
      prismaMock.notification.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.markAsDeleted(userId, notificationId),
      ).rejects.toThrow(NotFoundException);

      expect(redisMock.scanKeys).not.toHaveBeenCalled();

      expect(redisMock.delete).not.toHaveBeenCalled();
      expect(redisMock.xadd).not.toHaveBeenCalled();
    });
  });

  describe("createNotification", () => {
    it("создает уведомление с category и actionUrl", async () => {
      prismaMock.notification.create.mockResolvedValue(mockNotification);

      redisMock.scanKeys.mockResolvedValue([]);
      redisMock.delete.mockResolvedValue(undefined);
      redisMock.get.mockResolvedValue(null);
      redisMock.set.mockResolvedValue(undefined);
      redisMock.xadd.mockResolvedValue("1724500000000-0");

      prismaMock.notification.count.mockResolvedValue(1);

      const result = await service.createNotification({
        userId,
        category: NotificationType.INTERVIEW,
        title: "Новое уведомление",
        message: "Тестовое уведомление",
        actionUrl: "/interviews/123",
      });

      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: {
          userId,
          category: NotificationType.INTERVIEW,
          title: "Новое уведомление",
          message: "Тестовое уведомление",
          actionUrl: "/interviews/123",
        },
      });

      expect(result).toEqual(mockNotification);
    });

    it("инвалидирует все закэшированные страницы уведомлений", async () => {
      const firstPageKey = `notifications:${userId}:page:1:limit:20`;

      const secondPageKey = `notifications:${userId}:page:2:limit:20`;

      redisMock.scanKeys.mockResolvedValue([firstPageKey, secondPageKey]);

      prismaMock.notification.create.mockResolvedValue(mockNotification);

      redisMock.delete.mockResolvedValue(undefined);
      redisMock.get.mockResolvedValue(null);
      redisMock.set.mockResolvedValue(undefined);
      redisMock.xadd.mockResolvedValue("1724500000000-0");

      prismaMock.notification.count.mockResolvedValue(1);

      await service.createNotification({
        userId,
        category: NotificationType.INTERVIEW,
        title: "Новое уведомление",
        message: "Тестовое уведомление",
        actionUrl: "/interviews/123",
      });

      expect(redisMock.scanKeys).toHaveBeenCalledWith(
        notificationsCachePattern,
      );

      expect(redisMock.delete).toHaveBeenCalledWith(firstPageKey);

      expect(redisMock.delete).toHaveBeenCalledWith(secondPageKey);

      expect(redisMock.delete).toHaveBeenCalledWith(unreadCountCacheKey);
    });

    it("публикует notification.new в Redis Stream", async () => {
      prismaMock.notification.create.mockResolvedValue(mockNotification);

      redisMock.scanKeys.mockResolvedValue([]);
      redisMock.delete.mockResolvedValue(undefined);
      redisMock.get.mockResolvedValue(null);
      redisMock.set.mockResolvedValue(undefined);
      redisMock.xadd.mockResolvedValue("1724500000000-0");

      prismaMock.notification.count.mockResolvedValue(1);

      await service.createNotification({
        userId,
        category: NotificationType.INTERVIEW,
        title: "Новое уведомление",
        message: "Тестовое уведомление",
        actionUrl: "/interviews/123",
      });

      expect(redisMock.xadd).toHaveBeenCalledWith(
        notificationStreamKey,
        "notification.new",
        {
          id: notificationId,
          title: "Новое уведомление",
          message: "Тестовое уведомление",
          category: NotificationType.INTERVIEW,
          actionUrl: "/interviews/123",
        },
        100,
        604800,
      );
    });

    it("публикует актуальный unread badge после создания уведомления", async () => {
      prismaMock.notification.create.mockResolvedValue(mockNotification);

      redisMock.scanKeys.mockResolvedValue([]);
      redisMock.delete.mockResolvedValue(undefined);
      redisMock.get.mockResolvedValue(null);
      redisMock.set.mockResolvedValue(undefined);
      redisMock.xadd.mockResolvedValue("1724500000000-0");

      prismaMock.notification.count.mockResolvedValue(1);

      await service.createNotification({
        userId,
        category: NotificationType.INTERVIEW,
        title: "Новое уведомление",
        message: "Тестовое уведомление",
        actionUrl: "/interviews/123",
      });

      expect(redisMock.xadd).toHaveBeenCalledWith(
        notificationStreamKey,
        "notification.badge",
        {
          unreadCount: 1,
        },
        100,
        604800,
      );

      expect(redisMock.xadd).toHaveBeenCalledTimes(2);
    });
  });
});
