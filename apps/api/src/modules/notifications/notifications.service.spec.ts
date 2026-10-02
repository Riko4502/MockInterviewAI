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
      upsert: jest.Mock;
      update: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
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
    type: "interview.match_proposed",
    payload: {
      sessionId: "33333333-3333-4333-a333-333333333333",
      proposedSlotId: "44444444-4444-4444-a444-444444444444",
      proposedStartUtc: "2026-10-01T09:00:00.000Z",
      senderName: "Иван",
    },
    renderedTitle: "Предложен слот",
    renderedMessage: "Иван предлагает провести интервью.",
    renderedLocale: "ru",
    renderedTimezone: "Europe/Moscow",
    dedupKey: `interview.match_proposed:${userId}:session=33333333-3333-4333-a333-333333333333&slot=44444444-4444-4444-a444-444444444444&start=2026-10-01T09:00:00.000Z`,
    actionUrl: "/interviews/123",
    readAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  /** То, что реально уходит клиенту: без dedupKey и полей рендера. */
  const mockWireNotification = {
    id: notificationId,
    userId,
    category: NotificationType.INTERVIEW,
    type: "interview.match_proposed",
    payload: mockNotification.payload,
    title: mockNotification.renderedTitle,
    message: mockNotification.renderedMessage,
    actionUrl: "/interviews/123",
    readAt: null,
    deletedAt: null,
    createdAt: mockNotification.createdAt,
    updatedAt: mockNotification.updatedAt,
  };

  const matchProposedEvent = {
    type: "interview.match_proposed" as const,
    payload: {
      sessionId: "33333333-3333-4333-a333-333333333333",
      proposedSlotId: "44444444-4444-4444-a444-444444444444",
      proposedStartUtc: "2026-10-01T09:00:00.000Z",
      senderName: "Иван",
    },
  };

  beforeEach(() => {
    prismaMock = {
      notification: {
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          locale: "ru",
          timezone: "Europe/Moscow",
        }),
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
        items: [mockWireNotification],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it("не отдаёт наружу dedupKey и поля рендера", async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.notification.findMany.mockResolvedValue([mockNotification]);
      prismaMock.notification.count.mockResolvedValue(1);
      redisMock.scanKeys.mockResolvedValue([]);

      const result = await service.getNotifications(userId, page, limit);

      const [item] = result.items as unknown as Record<string, unknown>[];

      expect(item).not.toHaveProperty("dedupKey");
      expect(item).not.toHaveProperty("renderedTitle");
      expect(item).not.toHaveProperty("renderedTimezone");
    });

    it("дорисовывает текст, если отрендеренные колонки NULL", async () => {
      const notRendered = {
        ...mockNotification,
        renderedTitle: null,
        renderedMessage: null,
        renderedLocale: null,
        renderedTimezone: null,
      };

      prismaMock.notification.update.mockResolvedValue(notRendered);
      prismaMock.notification.findMany.mockResolvedValue([notRendered]);
      prismaMock.notification.count.mockResolvedValue(1);
      redisMock.get.mockResolvedValue(null);
      redisMock.scanKeys.mockResolvedValue([]);

      const result = await service.getNotifications(userId, page, limit);

      const [item] = result.items as unknown as Record<string, string>[];

      expect(item.title).not.toBe("");
      expect(item.message).not.toBe("");
      expect(item.message).toContain("Иван");
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

      expect(result).toEqual({
        ...cachedResult,
        items: [
          {
            ...mockWireNotification,
            createdAt: mockNotification.createdAt.toISOString(),
            updatedAt: mockNotification.updatedAt.toISOString(),
          },
        ],
      });
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
  });

  describe("category", () => {
    it.each([
      NotificationType.INTERVIEW,
      NotificationType.MESSAGE,
      NotificationType.SYSTEM,
    ])("фильтрует список и total по %s до пагинации", async (category) => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.notification.findMany.mockResolvedValue([]);
      prismaMock.notification.count.mockResolvedValue(21);
      const result = await service.getNotifications(userId, 2, 20, category);
      const where = { userId, deletedAt: null, category };
      expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where, skip: 20, take: 20 }),
      );
      expect(prismaMock.notification.count).toHaveBeenCalledWith({ where });
      expect(result.total).toBe(21);
      expect(result.totalPages).toBe(2);
      expect(redisMock.get).toHaveBeenCalledWith(
        `${notificationsCacheKey.replace("page:1", "page:2")}:category:${category}`,
      );
    });
    it("использует отдельный ключ кэша для категории", async () => {
      const cached = { items: [], total: 0, totalPages: 0, page: 1, limit: 20 };
      redisMock.get.mockResolvedValue(JSON.stringify(cached));
      expect(
        await service.getNotifications(userId, 1, 20, NotificationType.MESSAGE),
      ).toEqual(cached);
      expect(redisMock.get).toHaveBeenCalledWith(
        `${notificationsCacheKey}:category:MESSAGE`,
      );
      expect(prismaMock.notification.findMany).not.toHaveBeenCalled();
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

  describe("markAllAsRead", () => {
    it("помечает все непрочитанные уведомления пользователя прочитанными", async () => {
      prismaMock.notification.updateMany.mockResolvedValue({
        count: 3,
      });

      redisMock.scanKeys.mockResolvedValue([]);
      redisMock.delete.mockResolvedValue(undefined);
      redisMock.get.mockResolvedValue("0");
      redisMock.xadd.mockResolvedValue("1724500000000-0");

      const result = await service.markAllAsRead(userId);

      expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId,
          readAt: null,
          deletedAt: null,
        },
        data: {
          readAt: expect.any(Date),
        },
      });

      expect(result).toEqual({
        success: true,
      });
    });

    it("возвращает success если непрочитанных уведомлений нет", async () => {
      prismaMock.notification.updateMany.mockResolvedValue({
        count: 0,
      });

      redisMock.scanKeys.mockResolvedValue([]);
      redisMock.delete.mockResolvedValue(undefined);
      redisMock.get.mockResolvedValue("0");
      redisMock.xadd.mockResolvedValue("1724500000000-0");

      await expect(service.markAllAsRead(userId)).resolves.toEqual({
        success: true,
      });
    });

    it("не возвращает ошибку клиенту если Redis недоступен после успешного обновления PostgreSQL", async () => {
      prismaMock.notification.updateMany.mockResolvedValue({
        count: 3,
      });

      redisMock.scanKeys.mockRejectedValue(new Error("Redis unavailable"));

      await expect(service.markAllAsRead(userId)).resolves.toEqual({
        success: true,
      });
    });
  });

  describe("markAsRead", () => {
    it("помечает уведомление прочитанным", async () => {
      prismaMock.notification.updateMany.mockResolvedValue({
        count: 1,
      });

      redisMock.scanKeys.mockResolvedValue([]);
      redisMock.delete.mockResolvedValue(undefined);
      redisMock.get.mockResolvedValue("0");
      redisMock.xadd.mockResolvedValue("1724500000000-0");

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

      expect(result).toEqual({
        success: true,
      });
    });

    it("не возвращает ошибку клиенту если Redis недоступен после успешного обновления PostgreSQL", async () => {
      prismaMock.notification.updateMany.mockResolvedValue({
        count: 1,
      });

      redisMock.scanKeys.mockRejectedValue(new Error("Redis unavailable"));

      await expect(service.markAsRead(userId, notificationId)).resolves.toEqual(
        {
          success: true,
        },
      );
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
    it("выполняет soft-delete уведомления", async () => {
      prismaMock.notification.updateMany.mockResolvedValue({
        count: 1,
      });

      redisMock.scanKeys.mockResolvedValue([]);
      redisMock.delete.mockResolvedValue(undefined);
      redisMock.get.mockResolvedValue("0");
      redisMock.xadd.mockResolvedValue("1724500000000-0");

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

      expect(result).toEqual({
        success: true,
      });
    });

    it("не возвращает ошибку клиенту если Redis недоступен после успешного soft-delete", async () => {
      prismaMock.notification.updateMany.mockResolvedValue({
        count: 1,
      });

      redisMock.scanKeys.mockRejectedValue(new Error("Redis unavailable"));

      await expect(
        service.markAsDeleted(userId, notificationId),
      ).resolves.toEqual({
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
    const arrange = () => {
      redisMock.scanKeys.mockResolvedValue([]);
      redisMock.delete.mockResolvedValue(undefined);
      redisMock.get.mockResolvedValue(null);
      redisMock.set.mockResolvedValue(undefined);
      redisMock.xadd.mockResolvedValue("1724500000000-0");
      prismaMock.notification.count.mockResolvedValue(1);
      prismaMock.notification.upsert.mockResolvedValue(mockNotification);
    };

    it("рендерит текст из типа события и payload, а не из готовых строк", async () => {
      arrange();

      const result = await service.createNotification({
        userId,
        type: matchProposedEvent.type,
        payload: matchProposedEvent.payload,
        actionUrl: "/interviews/123",
      });

      expect(prismaMock.notification.upsert).toHaveBeenCalledWith({
        where: { dedupKey: mockNotification.dedupKey },
        create: expect.objectContaining({
          userId,
          category: NotificationType.INTERVIEW,
          type: "interview.match_proposed",
          payload: matchProposedEvent.payload,
          actionUrl: "/interviews/123",
        }),
        // Повторная доставка не должна двигать createdAt и менять текст.
        update: {},
      });

      expect(result).toEqual(mockNotification);
    });

    it("отдаёт в SSE кадр текст свежего рендера, а не строки кэша", async () => {
      arrange();

      await service.createNotification({
        userId,
        type: matchProposedEvent.type,
        payload: matchProposedEvent.payload,
        actionUrl: "/interviews/123",
      });

      // Кэш рендера в моке намеренно отличается от того, что даёт шаблон
      // (нет даты слота). Кадр обязан нести текст, который получатель
      // увидит в тосте, а не устаревшую копию из колонки.
      expect(redisMock.xadd).toHaveBeenCalledWith(
        notificationStreamKey,
        "notification.new",
        {
          id: notificationId,
          title: mockNotification.renderedTitle,
          message: "Иван предлагает провести интервью 1 окт. 2026 г., 12:00.",
          category: NotificationType.INTERVIEW,
          actionUrl: "/interviews/123",
          createdAt: mockNotification.createdAt.toISOString(),
          read: false,
        },
        100,
        604800,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      );
    });

    it("публикует кадр, даже если колонки рендера в базе NULL", async () => {
      arrange();
      // Повторная доставка: upsert с update: {} возвращает прежнюю строку,
      // а её рендер мог остаться непосчитанным (ADR-003:58 — NULL означает
      // «ещё не отрендерено»). Кадр с title: null не прошёл бы проверку
      // словаря и уронил бы весь createNotification после записи в БД.
      prismaMock.notification.upsert.mockResolvedValue({
        ...mockNotification,
        renderedTitle: null,
        renderedMessage: null,
        renderedLocale: null,
        renderedTimezone: null,
      });

      await service.createNotification({
        userId,
        type: matchProposedEvent.type,
        payload: matchProposedEvent.payload,
      });

      expect(redisMock.xadd).toHaveBeenCalledWith(
        notificationStreamKey,
        "notification.new",
        expect.objectContaining({
          title: mockNotification.renderedTitle,
          message: "Иван предлагает провести интервью 1 окт. 2026 г., 12:00.",
        }),
        100,
        604800,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      );
    });

    it("выводит время в таймзоне читателя", async () => {
      arrange();
      prismaMock.notification.upsert.mockResolvedValue(mockNotification);

      await service.createNotification({
        userId,
        type: matchProposedEvent.type,
        payload: matchProposedEvent.payload,
      });

      expect(prismaMock.notification.upsert).toHaveBeenCalledWith({
        where: { dedupKey: mockNotification.dedupKey },
        create: expect.objectContaining({
          renderedTimezone: "Europe/Moscow",
          renderedLocale: "ru",
        }),
        update: {},
      });
    });

    it("не доверяет лишним полям payload", async () => {
      arrange();

      await service.createNotification({
        userId,
        type: matchProposedEvent.type,
        payload: {
          ...matchProposedEvent.payload,
          email: "leak@example.com",
        } as typeof matchProposedEvent.payload,
      });

      const call = prismaMock.notification.upsert.mock.calls[0][0];

      expect(call.create.payload).not.toHaveProperty("email");
    });

    it("инвалидирует все закэшированные страницы уведомлений", async () => {
      const firstPageKey = `notifications:${userId}:page:1:limit:20`;
      const secondPageKey = `notifications:${userId}:page:2:limit:20`;
      arrange();
      redisMock.scanKeys.mockResolvedValue([firstPageKey, secondPageKey]);

      await service.createNotification({
        userId,
        type: matchProposedEvent.type,
        payload: matchProposedEvent.payload,
        actionUrl: "/interviews/123",
      });

      expect(redisMock.scanKeys).toHaveBeenCalledWith(
        notificationsCachePattern,
      );
      expect(redisMock.delete).toHaveBeenCalledWith(firstPageKey);
      expect(redisMock.delete).toHaveBeenCalledWith(secondPageKey);
      expect(redisMock.delete).toHaveBeenCalledWith(unreadCountCacheKey);
    });

    it("публикует notification.new с read: true для прочитанного", async () => {
      arrange();
      prismaMock.notification.upsert.mockResolvedValue({
        ...mockNotification,
        readAt: new Date(),
      });

      await service.createNotification({
        userId,
        type: matchProposedEvent.type,
        payload: matchProposedEvent.payload,
      });

      expect(redisMock.xadd).toHaveBeenCalledWith(
        notificationStreamKey,
        "notification.new",
        expect.objectContaining({ read: true }),
        100,
        604800,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      );
    });

    it("публикует актуальный unread badge", async () => {
      arrange();

      await service.createNotification({
        userId,
        type: matchProposedEvent.type,
        payload: matchProposedEvent.payload,
        actionUrl: "/interviews/123",
      });

      expect(redisMock.xadd).toHaveBeenCalledWith(
        notificationStreamKey,
        "notification.badge",
        { unreadCount: 1 },
        100,
        604800,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      );
      expect(redisMock.xadd).toHaveBeenCalledTimes(2);
    });
  });
});
