import type {
  CreateMatchRequestDto,
  MatchRequestQueryDto,
  MatchRequestResponseDto,
  PaginatedResponseDto,
  RejectMatchRequestDto,
  UnreadMatchRequestsCountDto,
} from "@packages/dto";
import { MatchmakingController } from "./matchmaking.controller";
import type { MatchmakingService } from "./matchmaking.service";

describe("MatchmakingController", () => {
  let controller: MatchmakingController;
  let matchmakingServiceMock: {
    getUnreadCount: jest.Mock;
    create: jest.Mock;
    findIncoming: jest.Mock;
    findOutgoing: jest.Mock;
    accept: jest.Mock;
    reject: jest.Mock;
    cancel: jest.Mock;
  };

  const userId = "11111111-1111-4111-a111-111111111111";
  const receiverId = "22222222-2222-4222-a222-222222222222";
  const requestId = "33333333-3333-4333-a333-333333333333";
  const targetCardId = "44444444-4444-4444-a444-444444444444";

  const mockRequestResponse: MatchRequestResponseDto = {
    id: requestId,
    senderId: userId,
    receiverId,
    sender: {
      id: userId,
      displayName: "Sender User",
      username: "sender_user",
      avatarUrl: null,
      telegramUsername: null,
      gitUrl: null,
    },
    receiver: {
      id: receiverId,
      displayName: "Receiver User",
      username: "receiver_user",
      avatarUrl: null,
      telegramUsername: null,
      gitUrl: null,
    },
    targetCard: {
      id: targetCardId,
      userId: receiverId,
      title: "Целевая карточка",
      specialization: "FRONTEND",
      level: "MIDDLE",
      language: "RU",
      skills: ["React"],
      bio: null,
      scheduleInfo: null,
      isUrgent: false,
      autoRenew: false,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      bumpedAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      user: {
        id: receiverId,
        displayName: "Receiver User",
        username: "receiver_user",
        avatarUrl: null,
        telegramUsername: null,
        gitUrl: null,
      },
    },
    senderCard: null,
    status: "PENDING",
    message: "Привет, давай потренируем алгоритмы!",
    preferredTopic: "Алгоритмы и структуры данных",
    rejectReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
  };

  const mockPaginatedRequests: PaginatedResponseDto<MatchRequestResponseDto> = {
    data: [mockRequestResponse],
    meta: {
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    },
  };

  beforeEach(() => {
    matchmakingServiceMock = {
      getUnreadCount: jest.fn().mockResolvedValue({
        pendingCount: 3,
      } satisfies UnreadMatchRequestsCountDto),
      create: jest.fn().mockResolvedValue(mockRequestResponse),
      findIncoming: jest.fn().mockResolvedValue(mockPaginatedRequests),
      findOutgoing: jest.fn().mockResolvedValue(mockPaginatedRequests),
      accept: jest.fn().mockResolvedValue({
        ...mockRequestResponse,
        status: "ACCEPTED",
        sender: {
          ...mockRequestResponse.sender,
          telegramUsername: "sender_tg",
        },
        receiver: {
          ...mockRequestResponse.receiver,
          telegramUsername: "receiver_tg",
        },
      }),
      reject: jest.fn().mockResolvedValue({
        ...mockRequestResponse,
        status: "REJECTED",
        rejectReason: "Занят на этой неделе",
      }),
      cancel: jest.fn().mockResolvedValue({
        ...mockRequestResponse,
        status: "CANCELLED",
      }),
    };

    controller = new MatchmakingController(
      matchmakingServiceMock as unknown as MatchmakingService,
    );
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getUnreadCount", () => {
    it("возвращает количество входящих заявок в ожидании ответа", async () => {
      const result = await controller.getUnreadCount(userId);

      expect(matchmakingServiceMock.getUnreadCount).toHaveBeenCalledWith(
        userId,
      );
      expect(result).toEqual({ pendingCount: 3 });
    });
  });

  describe("create", () => {
    it("создает новую заявку через вызов сервиса с правильными параметрами", async () => {
      const dto: CreateMatchRequestDto = {
        targetCardId,
        message: "Привет, давай потренируем алгоритмы!",
        preferredTopic: "Алгоритмы и структуры данных",
      };

      const result = await controller.create(userId, dto);

      expect(matchmakingServiceMock.create).toHaveBeenCalledWith(userId, dto);
      expect(result).toEqual(mockRequestResponse);
    });
  });

  describe("findIncoming", () => {
    it("возвращает пагинированный список входящих заявок", async () => {
      const query: MatchRequestQueryDto = {
        page: 1,
        limit: 20,
        status: "PENDING",
      };

      const result = await controller.findIncoming(userId, query);

      expect(matchmakingServiceMock.findIncoming).toHaveBeenCalledWith(
        userId,
        query,
      );
      expect(result).toEqual(mockPaginatedRequests);
    });
  });

  describe("findOutgoing", () => {
    it("возвращает пагинированный список исходящих заявок", async () => {
      const query: MatchRequestQueryDto = {
        page: 1,
        limit: 20,
      };

      const result = await controller.findOutgoing(userId, query);

      expect(matchmakingServiceMock.findOutgoing).toHaveBeenCalledWith(
        userId,
        query,
      );
      expect(result).toEqual(mockPaginatedRequests);
    });
  });

  describe("accept", () => {
    it("принимает входящую заявку по ID", async () => {
      const result = await controller.accept(requestId, userId);

      expect(matchmakingServiceMock.accept).toHaveBeenCalledWith(
        requestId,
        userId,
      );
      expect(result.status).toBe("ACCEPTED");
      expect(result.sender.telegramUsername).toBe("sender_tg");
    });
  });

  describe("reject", () => {
    it("отклоняет входящую заявку с указанием причины", async () => {
      const dto: RejectMatchRequestDto = {
        reason: "Занят на этой неделе",
      };

      const result = await controller.reject(requestId, userId, dto);

      expect(matchmakingServiceMock.reject).toHaveBeenCalledWith(
        requestId,
        userId,
        dto,
      );
      expect(result.status).toBe("REJECTED");
      expect(result.rejectReason).toBe("Занят на этой неделе");
    });
  });

  describe("cancel", () => {
    it("отменяет исходящую заявку отправителем", async () => {
      const result = await controller.cancel(requestId, userId);

      expect(matchmakingServiceMock.cancel).toHaveBeenCalledWith(
        requestId,
        userId,
      );
      expect(result.status).toBe("CANCELLED");
    });
  });
});
