import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import type { RedisService } from "../../redis/redis.service";
import { REDIS_MATCHMAKING_EVENTS_CHANNEL } from "./matchmaking.constants";
import { MatchmakingService } from "./matchmaking.service";

describe("MatchmakingService", () => {
  let service: MatchmakingService;
  let prismaMock: {
    user: {
      findUnique: jest.Mock;
    };
    showcaseCard: {
      findUnique: jest.Mock;
    };
    matchRequest: {
      count: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let redisServiceMock: {
    publish: jest.Mock;
  };

  const senderId = "11111111-1111-4111-a111-111111111111";
  const receiverId = "22222222-2222-4222-a222-222222222222";
  const targetCardId = "33333333-3333-4333-a333-333333333333";
  const senderCardId = "44444444-4444-4444-a444-444444444444";
  const requestId = "55555555-5555-4555-a555-555555555555";

  const mockSenderUser = {
    id: senderId,
    displayName: "Sender Name",
    username: "sender_name",
    avatarUrl: "https://avatar.url/sender.png",
    telegramUsername: "sender_tg",
    gitUrl: "https://github.com/sender",
  };

  const mockReceiverUser = {
    id: receiverId,
    displayName: "Receiver Name",
    username: "receiver_name",
    avatarUrl: "https://avatar.url/receiver.png",
    telegramUsername: "receiver_tg",
    gitUrl: "https://github.com/receiver",
  };

  const mockTargetCard = {
    id: targetCardId,
    userId: receiverId,
    title: "Ищу напарника для тренировок",
    specialization: "FRONTEND",
    level: "MIDDLE",
    language: "RU",
    skills: ["React", "TypeScript"],
    bio: "Готовлюсь к собеседованиям",
    scheduleInfo: "Вечером по МСК",
    isUrgent: false,
    autoRenew: false,
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
    bumpedAt: new Date(),
    expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    user: mockReceiverUser,
  };

  const mockSenderCard = {
    id: senderCardId,
    userId: senderId,
    title: "Моя карточка",
    specialization: "FRONTEND",
    level: "MIDDLE",
    language: "RU",
    skills: ["React"],
    bio: "Своя карточка",
    scheduleInfo: null,
    isUrgent: false,
    autoRenew: false,
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
    bumpedAt: new Date(),
    expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    user: mockSenderUser,
  };

  const mockMatchRequest = {
    id: requestId,
    senderId,
    receiverId,
    targetCardId,
    senderCardId: null,
    status: "PENDING",
    message: "Привет, давай потренируем алгоритмы!",
    preferredTopic: "Алгоритмы",
    rejectReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    sender: mockSenderUser,
    receiver: mockReceiverUser,
    targetCard: mockTargetCard,
    senderCard: null,
  };

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
      },
      showcaseCard: {
        findUnique: jest.fn(),
      },
      matchRequest: {
        count: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    redisServiceMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    service = new MatchmakingService(
      prismaMock as unknown as PrismaService,
      redisServiceMock as unknown as RedisService,
    );
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getUnreadCount", () => {
    it("возвращает точное число PENDING заявок, адресованных пользователю", async () => {
      prismaMock.matchRequest.count.mockResolvedValueOnce(3);

      const result = await service.getUnreadCount(receiverId);

      expect(prismaMock.matchRequest.count).toHaveBeenCalledWith({
        where: {
          receiverId,
          status: "PENDING",
        },
      });
      expect(result).toEqual({ pendingCount: 3 });
    });
  });

  describe("create", () => {
    const validDto = {
      targetCardId,
      message: "Привет, потренируемся?",
      preferredTopic: "Алгоритмы",
    };

    it("бросает NotFoundException, если отправитель не найден", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.create(senderId, validDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("бросает BadRequestException, если у отправителя не заполнен профиль", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        ...mockSenderUser,
        displayName: "A", // меньше 2 символов
      });

      await expect(service.create(senderId, validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("бросает NotFoundException, если целевая карточка не найдена", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(mockSenderUser);
      prismaMock.showcaseCard.findUnique.mockResolvedValueOnce(null);

      await expect(service.create(senderId, validDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("бросает NotFoundException, если целевая карточка не активна или просрочена", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(mockSenderUser);
      prismaMock.showcaseCard.findUnique.mockResolvedValueOnce({
        ...mockTargetCard,
        status: "INACTIVE",
      });

      await expect(service.create(senderId, validDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("бросает BadRequestException при попытке откликнуться на свою карточку (self-invite)", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(mockSenderUser);
      prismaMock.showcaseCard.findUnique.mockResolvedValueOnce({
        ...mockTargetCard,
        userId: senderId, // своя карточка
      });

      await expect(service.create(senderId, validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("бросает ForbiddenException, если прикрепленная карточка отправителя ему не принадлежит", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(mockSenderUser);
      // 1-й findUnique - целевая карточка
      prismaMock.showcaseCard.findUnique.mockResolvedValueOnce(mockTargetCard);
      // 2-й findUnique - карточка отправителя
      prismaMock.showcaseCard.findUnique.mockResolvedValueOnce({
        ...mockSenderCard,
        userId: "someone-else-id",
      });

      await expect(
        service.create(senderId, { ...validDto, senderCardId }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("бросает BadRequestException, если достигнут лимит 10 входящих заявок на карточку", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(mockSenderUser);
      prismaMock.showcaseCard.findUnique.mockResolvedValueOnce(mockTargetCard);
      prismaMock.matchRequest.count.mockResolvedValueOnce(10);

      await expect(service.create(senderId, validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("бросает HttpException со статусом 429 при превышении лимита 5 исходящих заявок", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(mockSenderUser);
      prismaMock.showcaseCard.findUnique.mockResolvedValueOnce(mockTargetCard);
      // 1-й count - входящие на карточку (< 10)
      prismaMock.matchRequest.count.mockResolvedValueOnce(2);
      // 2-й count - исходящие от пользователя (>= 5)
      prismaMock.matchRequest.count.mockResolvedValueOnce(5);

      try {
        await service.create(senderId, validDto);
        fail("Должно было выбросить ошибку");
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    });

    it("бросает BadRequestException при нарушении 24-часового кулдауна после REJECT", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(mockSenderUser);
      prismaMock.showcaseCard.findUnique.mockResolvedValueOnce(mockTargetCard);
      prismaMock.matchRequest.count
        .mockResolvedValueOnce(1) // входящие < 10
        .mockResolvedValueOnce(1); // исходящие < 5
      // 1-й findFirst - проверка недавнего REJECTED
      prismaMock.matchRequest.findFirst.mockResolvedValueOnce({
        id: "rejected-id",
      });

      await expect(service.create(senderId, validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("успешно создает заявку в статусе PENDING, если встречной заявки нет", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(mockSenderUser);
      prismaMock.showcaseCard.findUnique.mockResolvedValueOnce(mockTargetCard);
      prismaMock.matchRequest.count
        .mockResolvedValueOnce(0) // входящие
        .mockResolvedValueOnce(0); // исходящие
      prismaMock.matchRequest.findFirst
        .mockResolvedValueOnce(null) // кулдаун REJECTED
        .mockResolvedValueOnce(null); // встречная заявка
      prismaMock.matchRequest.create.mockResolvedValueOnce(mockMatchRequest);

      const result = await service.create(senderId, validDto);

      expect(prismaMock.matchRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          senderId,
          receiverId,
          targetCardId,
          status: "PENDING",
        }),
        include: expect.any(Object),
      });

      expect(result.status).toBe("PENDING");
      // Контакты в статусе PENDING должны быть скрыты (null)
      expect(result.sender.telegramUsername).toBeNull();
      expect(result.receiver.telegramUsername).toBeNull();
    });

    it("бросает ConflictException при ошибке уникальности P2002 от Prisma (защита от race condition)", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(mockSenderUser);
      prismaMock.showcaseCard.findUnique.mockResolvedValueOnce(mockTargetCard);
      prismaMock.matchRequest.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prismaMock.matchRequest.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const p2002Error = new Error("Unique constraint failed");
      (p2002Error as unknown as { code: string }).code = "P2002";
      prismaMock.matchRequest.create.mockRejectedValueOnce(p2002Error);

      await expect(service.create(senderId, validDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it("повторяет транзакцию при конфликте сериализации P2034 и успешно создает заявку", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(mockSenderUser);
      prismaMock.showcaseCard.findUnique.mockResolvedValueOnce(mockTargetCard);

      const p2034Error = new Error("Serialization conflict");
      (p2034Error as unknown as { code: string }).code = "P2034";

      // 1-я попытка транзакции падает с P2034, 2-я проходит успешно
      prismaMock.$transaction
        .mockRejectedValueOnce(p2034Error)
        .mockImplementationOnce((callback) => callback(prismaMock));

      prismaMock.matchRequest.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prismaMock.matchRequest.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      prismaMock.matchRequest.create.mockResolvedValueOnce(mockMatchRequest);

      const result = await service.create(senderId, validDto);

      expect(result.status).toBe("PENDING");
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    });

    it("автоматически переводит обе заявки в ACCEPTED при встречном отклике (Auto-match)", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(mockSenderUser);
      prismaMock.showcaseCard.findUnique.mockResolvedValueOnce(mockTargetCard);
      prismaMock.matchRequest.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prismaMock.matchRequest.findFirst
        .mockResolvedValueOnce(null) // нет недавнего REJECT
        .mockResolvedValueOnce({ id: "cross-request-id" }); // есть встречная!

      const acceptedMockRequest = {
        ...mockMatchRequest,
        status: "ACCEPTED",
      };

      prismaMock.matchRequest.create.mockResolvedValueOnce(acceptedMockRequest);
      prismaMock.matchRequest.updateMany.mockResolvedValueOnce({ count: 1 });

      const result = await service.create(senderId, validDto);

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(redisServiceMock.publish).toHaveBeenCalledWith(
        REDIS_MATCHMAKING_EVENTS_CHANNEL,
        expect.stringContaining("match.accepted"),
      );

      expect(result.status).toBe("ACCEPTED");
      // При ACCEPTED контакты раскрываются
      expect(result.sender.telegramUsername).toBe("sender_tg");
      expect(result.receiver.telegramUsername).toBe("receiver_tg");
    });

    it("создает обычную PENDING заявку, если встречная заявка была отменена параллельно (updateMany count === 0)", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(mockSenderUser);
      prismaMock.showcaseCard.findUnique.mockResolvedValueOnce(mockTargetCard);
      prismaMock.matchRequest.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prismaMock.matchRequest.findFirst
        .mockResolvedValueOnce(null) // нет недавнего REJECT
        .mockResolvedValueOnce({ id: "cross-request-id" }); // найдена в начале

      // В момент updateMany встречная заявка уже отменена (count === 0)
      prismaMock.matchRequest.updateMany.mockResolvedValueOnce({ count: 0 });
      prismaMock.matchRequest.create.mockResolvedValueOnce(mockMatchRequest);

      const result = await service.create(senderId, validDto);

      expect(result.status).toBe("PENDING");
      expect(redisServiceMock.publish).not.toHaveBeenCalled();
    });
  });

  describe("findIncoming and findOutgoing", () => {
    it("findIncoming возвращает пагинированный список входящих заявок", async () => {
      prismaMock.matchRequest.count.mockResolvedValueOnce(1);
      prismaMock.matchRequest.findMany.mockResolvedValueOnce([
        mockMatchRequest,
      ]);

      const result = await service.findIncoming(receiverId, {
        page: 1,
        limit: 20,
      });

      expect(prismaMock.matchRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { receiverId },
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it("findOutgoing возвращает пагинированный список исходящих заявок", async () => {
      prismaMock.matchRequest.count.mockResolvedValueOnce(1);
      prismaMock.matchRequest.findMany.mockResolvedValueOnce([
        mockMatchRequest,
      ]);

      const result = await service.findOutgoing(senderId, {
        page: 1,
        limit: 20,
      });

      expect(prismaMock.matchRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { senderId },
        }),
      );
      expect(result.data).toHaveLength(1);
    });
  });

  describe("accept", () => {
    it("бросает NotFoundException, если заявка не найдена", async () => {
      prismaMock.matchRequest.findUnique.mockResolvedValueOnce(null);

      await expect(service.accept(requestId, receiverId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("бросает ForbiddenException, если пользователь не является получателем заявки", async () => {
      prismaMock.matchRequest.findUnique.mockResolvedValueOnce({
        id: requestId,
        receiverId: "another-receiver-id",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(service.accept(requestId, receiverId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("бросает BadRequestException, если заявка не в статусе PENDING", async () => {
      prismaMock.matchRequest.findUnique.mockResolvedValueOnce({
        id: requestId,
        receiverId,
        status: "REJECTED",
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(service.accept(requestId, receiverId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("бросает BadRequestException и переводит в EXPIRED, если срок заявки истёк", async () => {
      prismaMock.matchRequest.findUnique.mockResolvedValueOnce({
        id: requestId,
        receiverId,
        status: "PENDING",
        expiresAt: new Date(Date.now() - 1000), // в прошлом
      });

      await expect(service.accept(requestId, receiverId)).rejects.toThrow(
        BadRequestException,
      );

      expect(prismaMock.matchRequest.updateMany).toHaveBeenCalledWith({
        where: { id: requestId, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
    });

    it("бросает BadRequestException, если статус изменился параллельно при accept", async () => {
      prismaMock.matchRequest.findUnique.mockResolvedValueOnce({
        id: requestId,
        receiverId,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 100000),
      });

      prismaMock.matchRequest.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.accept(requestId, receiverId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("успешно переводит заявку в ACCEPTED, публикует в Redis и открывает контакты", async () => {
      prismaMock.matchRequest.findUnique.mockResolvedValueOnce({
        id: requestId,
        receiverId,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 100000),
      });

      prismaMock.matchRequest.updateMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.matchRequest.findUniqueOrThrow.mockResolvedValueOnce({
        ...mockMatchRequest,
        status: "ACCEPTED",
      });

      const result = await service.accept(requestId, receiverId);

      expect(prismaMock.matchRequest.updateMany).toHaveBeenCalledWith({
        where: { id: requestId, status: "PENDING" },
        data: { status: "ACCEPTED" },
      });

      expect(prismaMock.matchRequest.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: requestId },
        include: expect.any(Object),
      });

      expect(redisServiceMock.publish).toHaveBeenCalledWith(
        REDIS_MATCHMAKING_EVENTS_CHANNEL,
        expect.stringContaining("match.accepted"),
      );

      expect(result.status).toBe("ACCEPTED");
      expect(result.sender.telegramUsername).toBe("sender_tg");
      expect(result.receiver.telegramUsername).toBe("receiver_tg");
    });
  });

  describe("reject", () => {
    it("бросает NotFoundException, если заявка не найдена", async () => {
      prismaMock.matchRequest.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.reject(requestId, receiverId, { reason: "Занят" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("бросает ForbiddenException, если пользователь не получатель", async () => {
      prismaMock.matchRequest.findUnique.mockResolvedValueOnce({
        id: requestId,
        receiverId: "another-receiver",
        status: "PENDING",
      });

      await expect(
        service.reject(requestId, receiverId, { reason: "Занят" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("бросает BadRequestException, если статус изменился параллельно при reject", async () => {
      prismaMock.matchRequest.findUnique.mockResolvedValueOnce({
        id: requestId,
        receiverId,
        status: "PENDING",
      });

      prismaMock.matchRequest.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.reject(requestId, receiverId, { reason: "Занят" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("успешно переводит в REJECTED с сохранением причины", async () => {
      prismaMock.matchRequest.findUnique.mockResolvedValueOnce({
        id: requestId,
        receiverId,
        status: "PENDING",
      });

      prismaMock.matchRequest.updateMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.matchRequest.findUniqueOrThrow.mockResolvedValueOnce({
        ...mockMatchRequest,
        status: "REJECTED",
        rejectReason: "Занят на этой неделе",
      });

      const result = await service.reject(requestId, receiverId, {
        reason: "Занят на этой неделе",
      });

      expect(prismaMock.matchRequest.updateMany).toHaveBeenCalledWith({
        where: { id: requestId, status: "PENDING" },
        data: {
          status: "REJECTED",
          rejectReason: "Занят на этой неделе",
        },
      });

      expect(prismaMock.matchRequest.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: requestId },
        include: expect.any(Object),
      });

      expect(result.status).toBe("REJECTED");
      expect(result.rejectReason).toBe("Занят на этой неделе");
      // Контакты должны быть скрыты
      expect(result.sender.telegramUsername).toBeNull();
    });
  });

  describe("cancel", () => {
    it("бросает NotFoundException, если заявка не найдена", async () => {
      prismaMock.matchRequest.findUnique.mockResolvedValueOnce(null);

      await expect(service.cancel(requestId, senderId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("бросает ForbiddenException, если пользователь не отправитель", async () => {
      prismaMock.matchRequest.findUnique.mockResolvedValueOnce({
        id: requestId,
        senderId: "another-sender",
        status: "PENDING",
      });

      await expect(service.cancel(requestId, senderId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("бросает BadRequestException, если статус изменился параллельно при cancel", async () => {
      prismaMock.matchRequest.findUnique.mockResolvedValueOnce({
        id: requestId,
        senderId,
        status: "PENDING",
      });

      prismaMock.matchRequest.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.cancel(requestId, senderId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("успешно отменяет заявку отправителем (CANCELLED)", async () => {
      prismaMock.matchRequest.findUnique.mockResolvedValueOnce({
        id: requestId,
        senderId,
        status: "PENDING",
      });

      prismaMock.matchRequest.updateMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.matchRequest.findUniqueOrThrow.mockResolvedValueOnce({
        ...mockMatchRequest,
        status: "CANCELLED",
      });

      const result = await service.cancel(requestId, senderId);

      expect(prismaMock.matchRequest.updateMany).toHaveBeenCalledWith({
        where: { id: requestId, status: "PENDING" },
        data: {
          status: "CANCELLED",
        },
      });

      expect(prismaMock.matchRequest.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: requestId },
        include: expect.any(Object),
      });

      expect(result.status).toBe("CANCELLED");
    });
  });
});
