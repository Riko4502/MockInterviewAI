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
import type { NotificationDispatcher } from "../notifications/notification-dispatcher.service";
import {
  LiveMatchPostCommitError,
  type SessionsService,
} from "../sessions/sessions.service";
import { MatchmakingService } from "./matchmaking.service";

describe("MatchmakingService", () => {
  let service: MatchmakingService;
  let notificationDispatcherMock: { dispatch: jest.Mock };
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
    availabilitySlot: {
      updateMany: jest.Mock;
    };
    interviewSession: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let redisServiceMock: {
    publish: jest.Mock;
  };
  let sessionsServiceMock: {
    createLiveMatchSession: jest.Mock;
    cleanupOrphanedSession: jest.Mock;
  };

  const senderId = "11111111-1111-4111-a111-111111111111";
  const receiverId = "22222222-2222-4222-a222-222222222222";
  const targetCardId = "33333333-3333-4333-a333-333333333333";
  const senderCardId = "44444444-4444-4444-a444-444444444444";
  const requestId = "55555555-5555-4555-a555-555555555555";
  const slotId = "66666666-6666-4666-a666-666666666666";
  const sessionId = "77777777-7777-4777-a777-777777777777";

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

  const mockTargetSlot = {
    id: slotId,
    startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    durationMinutes: 60,
    status: "OPEN",
  } as const;

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
    slots: [],
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
    slots: [],
    user: mockSenderUser,
  };

  const mockMatchRequest = {
    id: requestId,
    senderId,
    receiverId,
    targetCardId,
    senderCardId: null,
    slotId: null,
    sessionId: null,
    status: "PENDING",
    message: "Привет, давай потренируем алгоритмы!",
    preferredTopic: "Алгоритмы",
    rejectReason: null,
    session: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    sender: mockSenderUser,
    receiver: mockReceiverUser,
    targetCard: mockTargetCard,
    senderCard: null,
    slot: null,
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
      availabilitySlot: {
        updateMany: jest.fn(),
      },
      interviewSession: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    notificationDispatcherMock = {
      dispatch: jest.fn().mockResolvedValue({ id: "outbox-row-id" }),
    };

    sessionsServiceMock = {
      createLiveMatchSession: jest.fn().mockResolvedValue({
        sessionId: "mock-session-id-123",
        inviteToken: "mock-invite-token",
      }),
      cleanupOrphanedSession: jest.fn().mockResolvedValue(undefined),
    };

    redisServiceMock = {
      publish: jest.fn().mockResolvedValue("published"),
    };

    service = new MatchmakingService(
      prismaMock as unknown as PrismaService,
      notificationDispatcherMock as unknown as NotificationDispatcher,
      redisServiceMock as unknown as RedisService,
      sessionsServiceMock as unknown as SessionsService,
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
          expiresAt: { gt: expect.any(Date) },
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

    it("бросает ConflictException, если исчерпаны все попытки повтора при P2034", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockSenderUser);
      prismaMock.showcaseCard.findUnique.mockResolvedValue(mockTargetCard);

      const p2034Error = new Error("Serialization conflict");
      (p2034Error as unknown as { code: string }).code = "P2034";

      prismaMock.$transaction.mockRejectedValue(p2034Error);

      await expect(service.create(senderId, validDto)).rejects.toThrow(
        ConflictException,
      );
      // Начальная попытка + 3 повтора = 4 вызова
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(4);
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
      // Встречная заявка переводится в ACCEPTED атомарно с привязкой к общей
      // живой сессии, а вторая создаётся сразу в ACCEPTED (ADR-002:109).
      expect(prismaMock.matchRequest.updateMany).toHaveBeenCalledWith({
        where: {
          id: "cross-request-id",
          status: "PENDING",
          expiresAt: { gt: expect.any(Date) },
        },
        data: { status: "ACCEPTED", sessionId: "mock-session-id-123" },
      });

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
    });

    it("очищает сессию при возникновении LiveMatchPostCommitError при встречном отклике", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(mockSenderUser);
      prismaMock.showcaseCard.findUnique.mockResolvedValueOnce(mockTargetCard);
      prismaMock.matchRequest.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prismaMock.matchRequest.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "cross-request-id",
          senderId: receiverId,
        });

      const postCommitError = new LiveMatchPostCommitError(
        "post-commit-session-id",
        "post-commit-token",
        "Redis warm-up failed",
      );
      sessionsServiceMock.createLiveMatchSession.mockRejectedValueOnce(
        postCommitError,
      );

      await expect(service.create(senderId, validDto)).rejects.toThrow(
        LiveMatchPostCommitError,
      );

      expect(sessionsServiceMock.cleanupOrphanedSession).toHaveBeenCalledWith(
        "post-commit-session-id",
      );
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
        ...mockMatchRequest,
        expiresAt: new Date(Date.now() - 1000), // в прошлом
      });
      prismaMock.matchRequest.updateMany.mockResolvedValueOnce({ count: 1 });

      await expect(service.accept(requestId, receiverId)).rejects.toThrow(
        BadRequestException,
      );

      expect(prismaMock.matchRequest.updateMany).toHaveBeenCalledWith({
        where: { id: requestId, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
    });

    it("освобождает слот вместе с истёкшей заявкой", async () => {
      prismaMock.matchRequest.findUnique.mockResolvedValueOnce({
        ...mockMatchRequest,
        slotId,
        slot: {
          ...mockTargetSlot,
          status: "BOOKED",
          bookedByRequestId: requestId,
        },
        expiresAt: new Date(Date.now() - 1000),
      });
      prismaMock.matchRequest.updateMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.availabilitySlot.updateMany.mockResolvedValueOnce({
        count: 1,
      });

      await expect(service.accept(requestId, receiverId)).rejects.toThrow(
        BadRequestException,
      );

      expect(prismaMock.availabilitySlot.updateMany).toHaveBeenCalledWith({
        where: {
          id: slotId,
          status: "BOOKED",
          bookedByRequestId: requestId,
        },
        data: { status: "OPEN", bookedByRequestId: null },
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

    it("не удаляет сессию при ошибке после того, как сессия уже была привязана к заявке", async () => {
      prismaMock.matchRequest.findUnique.mockResolvedValueOnce({
        id: requestId,
        receiverId,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 100000),
      });

      prismaMock.matchRequest.updateMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.matchRequest.findUniqueOrThrow.mockRejectedValueOnce(
        new Error("Database error during reread"),
      );

      await expect(service.accept(requestId, receiverId)).rejects.toThrow(
        "Database error during reread",
      );

      expect(sessionsServiceMock.cleanupOrphanedSession).not.toHaveBeenCalled();
    });

    it("успешно переводит заявку в ACCEPTED и открывает контакты", async () => {
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

  describe("слоты расписания", () => {
    const cardWithSlot = {
      ...mockTargetCard,
      slots: [mockTargetSlot],
    };

    const bookedRequest = {
      ...mockMatchRequest,
      slotId,
      slot: {
        ...mockTargetSlot,
        status: "BOOKED",
        bookedByRequestId: requestId,
      },
    };

    beforeEach(() => {
      prismaMock.matchRequest.count.mockResolvedValue(0);
      prismaMock.matchRequest.findFirst.mockResolvedValue(null);
    });

    describe("create", () => {
      it("требует slotId, если у целевой карточки есть расписание", async () => {
        prismaMock.user.findUnique.mockResolvedValueOnce(mockSenderUser);
        prismaMock.showcaseCard.findUnique.mockResolvedValueOnce(cardWithSlot);

        await expect(
          service.create(senderId, { targetCardId, message: "Привет" }),
        ).rejects.toThrow(BadRequestException);
      });

      it("отклоняет слот, которого нет в расписании целевой карточки", async () => {
        prismaMock.user.findUnique.mockResolvedValueOnce(mockSenderUser);
        prismaMock.showcaseCard.findUnique.mockResolvedValueOnce(cardWithSlot);

        await expect(
          service.create(senderId, {
            targetCardId,
            message: "Привет",
            slotId: "99999999-9999-4999-a999-999999999999",
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it("резервирует слот и кладёт предложение в outbox в той же транзакции", async () => {
        prismaMock.user.findUnique.mockResolvedValueOnce(mockSenderUser);
        prismaMock.showcaseCard.findUnique.mockResolvedValueOnce(cardWithSlot);
        prismaMock.matchRequest.create.mockResolvedValueOnce({
          ...mockMatchRequest,
          slotId,
          slot: { ...mockTargetSlot, status: "BOOKED" },
        });
        prismaMock.availabilitySlot.updateMany.mockResolvedValueOnce({
          count: 1,
        });

        const result = await service.create(senderId, {
          targetCardId,
          message: "Привет",
          slotId,
        });

        expect(prismaMock.availabilitySlot.updateMany).toHaveBeenCalledWith({
          where: { id: slotId, status: "OPEN" },
          data: { status: "BOOKED", bookedByRequestId: result.id },
        });

        expect(notificationDispatcherMock.dispatch).toHaveBeenCalledWith(
          {
            type: "interview.match_proposed",
            payload: {
              requestId: result.id,
              proposedSlotId: slotId,
              proposedStartUtc: mockTargetSlot.startsAt.toISOString(),
              senderName: mockSenderUser.displayName,
            },
          },
          receiverId,
          prismaMock,
          `/matchmaking/requests/${result.id}`,
        );
      });

      it("бросает ConflictException, если слот успели занять", async () => {
        prismaMock.user.findUnique.mockResolvedValueOnce(mockSenderUser);
        prismaMock.showcaseCard.findUnique.mockResolvedValueOnce(cardWithSlot);
        prismaMock.matchRequest.create.mockResolvedValueOnce(mockMatchRequest);
        prismaMock.availabilitySlot.updateMany.mockResolvedValueOnce({
          count: 0,
        });

        await expect(
          service.create(senderId, {
            targetCardId,
            message: "Привет",
            slotId,
          }),
        ).rejects.toThrow(ConflictException);

        expect(notificationDispatcherMock.dispatch).not.toHaveBeenCalled();
      });

      it("не выполняет auto-match, если слоты есть у целевой карточки", async () => {
        prismaMock.user.findUnique.mockResolvedValueOnce(mockSenderUser);
        prismaMock.showcaseCard.findUnique.mockResolvedValueOnce(cardWithSlot);
        // Встречная заявка есть, но слоты есть — кросс-инвайт не выполняется.
        prismaMock.matchRequest.findFirst
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: "cross-request-id" });
        prismaMock.matchRequest.create.mockResolvedValueOnce({
          ...mockMatchRequest,
          slotId,
          slot: { ...mockTargetSlot, status: "BOOKED" },
        });
        prismaMock.availabilitySlot.updateMany.mockResolvedValueOnce({
          count: 1,
        });

        const result = await service.create(senderId, {
          targetCardId,
          message: "Привет",
          slotId,
        });

        expect(prismaMock.matchRequest.updateMany).not.toHaveBeenCalled();
        expect(result.status).toBe("PENDING");
      });

      it("переносит существующую PENDING-заявку на новый слот, сохраняя текст", async () => {
        const nextSlot = {
          ...mockTargetSlot,
          id: "77777777-7777-4777-a777-777777777777",
          startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        };

        prismaMock.user.findUnique.mockResolvedValueOnce(mockSenderUser);
        prismaMock.showcaseCard.findUnique.mockResolvedValueOnce({
          ...mockTargetCard,
          slots: [mockTargetSlot, nextSlot],
        });
        prismaMock.matchRequest.findFirst
          .mockResolvedValueOnce(null) // кулдаун
          .mockResolvedValueOnce(bookedRequest); // уже есть PENDING-заявка
        prismaMock.availabilitySlot.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.matchRequest.update.mockResolvedValueOnce({
          ...bookedRequest,
          slotId: nextSlot.id,
          slot: { ...nextSlot, status: "BOOKED" },
        });

        const result = await service.create(senderId, {
          targetCardId,
          message: "Другое сообщение",
          slotId: nextSlot.id,
        });

        // Старый слот освобождён, новый занят.
        expect(prismaMock.availabilitySlot.updateMany).toHaveBeenCalledWith({
          where: {
            id: slotId,
            status: "BOOKED",
            bookedByRequestId: requestId,
          },
          data: { status: "OPEN", bookedByRequestId: null },
        });
        expect(prismaMock.matchRequest.create).not.toHaveBeenCalled();
        expect(prismaMock.matchRequest.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: requestId },
            data: expect.objectContaining({ slotId: nextSlot.id }),
          }),
        );
        // Текст заявки сохраняется: клиент меняет время, а не содержание.
        expect(result.message).toBe(bookedRequest.message);
        expect(result.slot?.id).toBe(nextSlot.id);
      });
    });

    describe("accept", () => {
      it("создаёт InterviewSession на время слота и уведомляет обе стороны", async () => {
        prismaMock.matchRequest.findUnique.mockResolvedValueOnce(bookedRequest);
        prismaMock.matchRequest.updateMany.mockResolvedValueOnce({ count: 1 });
        prismaMock.interviewSession.create.mockResolvedValueOnce({
          id: sessionId,
        });
        prismaMock.matchRequest.findUniqueOrThrow.mockResolvedValueOnce({
          ...bookedRequest,
          status: "ACCEPTED",
          sessionId,
        });

        const result = await service.accept(requestId, receiverId);

        expect(prismaMock.interviewSession.create).toHaveBeenCalledWith({
          data: {
            userId: receiverId,
            status: "CREATED",
            scheduledAt: mockTargetSlot.startsAt,
            participants: {
              create: [
                { userId: receiverId, role: "CANDIDATE" },
                { userId: senderId, role: "INTERVIEWER" },
              ],
            },
          },
        });

        // Бронь остаётся за принятой заявкой.
        expect(prismaMock.availabilitySlot.updateMany).not.toHaveBeenCalled();

        expect(result.sessionId).toBe(sessionId);
        expect(notificationDispatcherMock.dispatch).toHaveBeenCalledWith(
          {
            type: "interview.slot_booked",
            payload: {
              sessionId,
              slotId,
              startUtc: mockTargetSlot.startsAt.toISOString(),
              otherParticipantName: mockSenderUser.displayName,
            },
          },
          receiverId,
          prismaMock,
          `/interviews/${sessionId}`,
        );
        expect(notificationDispatcherMock.dispatch).toHaveBeenCalledWith(
          expect.objectContaining({ type: "interview.slot_booked" }),
          senderId,
          prismaMock,
          `/interviews/${sessionId}`,
        );
      });

      it("не создаёт сессию для заявки без слота", async () => {
        prismaMock.matchRequest.findUnique.mockResolvedValueOnce(
          mockMatchRequest,
        );
        prismaMock.matchRequest.updateMany.mockResolvedValueOnce({ count: 1 });
        prismaMock.matchRequest.findUniqueOrThrow.mockResolvedValueOnce({
          ...mockMatchRequest,
          status: "ACCEPTED",
        });

        await service.accept(requestId, receiverId);

        expect(prismaMock.interviewSession.create).not.toHaveBeenCalled();
        expect(notificationDispatcherMock.dispatch).not.toHaveBeenCalled();
      });

      it("отклоняет заявку, время слота которой уже прошло", async () => {
        prismaMock.matchRequest.findUnique.mockResolvedValueOnce({
          ...bookedRequest,
          slot: {
            ...bookedRequest.slot,
            startsAt: new Date(Date.now() - 60 * 60 * 1000),
          },
        });
        prismaMock.matchRequest.updateMany.mockResolvedValueOnce({ count: 1 });

        await expect(service.accept(requestId, receiverId)).rejects.toThrow(
          BadRequestException,
        );

        expect(prismaMock.interviewSession.create).not.toHaveBeenCalled();
      });
    });

    describe("reject и cancel", () => {
      it("освобождает слот при отклонении", async () => {
        prismaMock.matchRequest.findUnique.mockResolvedValueOnce(bookedRequest);
        prismaMock.matchRequest.updateMany.mockResolvedValueOnce({ count: 1 });
        prismaMock.availabilitySlot.updateMany.mockResolvedValueOnce({
          count: 1,
        });
        prismaMock.matchRequest.findUniqueOrThrow.mockResolvedValueOnce({
          ...bookedRequest,
          status: "REJECTED",
        });

        await service.reject(requestId, receiverId, { reason: "Занят" });

        expect(prismaMock.availabilitySlot.updateMany).toHaveBeenCalledWith({
          where: {
            id: slotId,
            status: "BOOKED",
            bookedByRequestId: requestId,
          },
          data: { status: "OPEN", bookedByRequestId: null },
        });
      });

      it("не освобождает слот, если заявку уже отклонили параллельно", async () => {
        prismaMock.matchRequest.findUnique.mockResolvedValueOnce(bookedRequest);
        prismaMock.matchRequest.updateMany.mockResolvedValueOnce({ count: 0 });

        await expect(
          service.reject(requestId, receiverId, { reason: "Занят" }),
        ).rejects.toThrow(BadRequestException);

        expect(prismaMock.availabilitySlot.updateMany).not.toHaveBeenCalled();
      });

      it("освобождает слот при отмене заявки отправителем", async () => {
        prismaMock.matchRequest.findUnique.mockResolvedValueOnce(bookedRequest);
        prismaMock.matchRequest.updateMany.mockResolvedValueOnce({ count: 1 });
        prismaMock.availabilitySlot.updateMany.mockResolvedValueOnce({
          count: 1,
        });
        prismaMock.matchRequest.findUniqueOrThrow.mockResolvedValueOnce({
          ...bookedRequest,
          status: "CANCELLED",
        });

        await service.cancel(requestId, senderId);

        expect(prismaMock.availabilitySlot.updateMany).toHaveBeenCalledWith({
          where: {
            id: slotId,
            status: "BOOKED",
            bookedByRequestId: requestId,
          },
          data: { status: "OPEN", bookedByRequestId: null },
        });
      });
    });
  });
});
