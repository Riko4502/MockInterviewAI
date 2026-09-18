import type {
  CreateShowcaseCardDto,
  PaginatedResponseDto,
  ShowcaseCardResponseDto,
  ShowcaseQueryDto,
  UpdateShowcaseCardDto,
  UpdateShowcaseCardStatusDto,
} from "@packages/dto";
import { ShowcaseController } from "./showcase.controller";
import type { ShowcaseService } from "./showcase.service";

describe("ShowcaseController", () => {
  let controller: ShowcaseController;
  let showcaseServiceMock: {
    findAll: jest.Mock;
    findMyCards: jest.Mock;
    create: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    updateStatus: jest.Mock;
    bump: jest.Mock;
    renew: jest.Mock;
    remove: jest.Mock;
  };

  const userId = "11111111-1111-4111-a111-111111111111";
  const cardId = "22222222-2222-4222-a222-222222222222";

  const mockCard: ShowcaseCardResponseDto = {
    id: cardId,
    userId,
    title: "Ищу напарника для mock-собеседований",
    specialization: "FRONTEND",
    level: "MIDDLE",
    language: "RU",
    skills: ["React", "TypeScript"],
    bio: "Готовлюсь к собесам в бигтех",
    scheduleInfo: "По будням после 19:00",
    isUrgent: false,
    autoRenew: false,
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
    bumpedAt: new Date(),
    expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    user: {
      id: userId,
      displayName: "Test User",
      username: "test_user",
      avatarUrl: null,
      telegramUsername: null,
      gitUrl: null,
    },
  };

  const mockPaginatedCards: PaginatedResponseDto<ShowcaseCardResponseDto> = {
    data: [mockCard],
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
    showcaseServiceMock = {
      findAll: jest.fn().mockResolvedValue(mockPaginatedCards),
      findMyCards: jest.fn().mockResolvedValue([mockCard]),
      create: jest.fn().mockResolvedValue(mockCard),
      findOne: jest.fn().mockResolvedValue(mockCard),
      update: jest.fn().mockResolvedValue(mockCard),
      updateStatus: jest
        .fn()
        .mockResolvedValue({ ...mockCard, status: "INACTIVE" }),
      bump: jest.fn().mockResolvedValue(mockCard),
      renew: jest.fn().mockResolvedValue(mockCard),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    controller = new ShowcaseController(
      showcaseServiceMock as unknown as ShowcaseService,
    );
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findAll", () => {
    it("делегирует вызов showcaseService.findAll с query и currentUserId", async () => {
      const query: ShowcaseQueryDto = {
        page: 1,
        limit: 20,
        sortBy: "BUMPED",
        specialization: "FRONTEND",
      };

      const result = await controller.findAll(query, userId);

      expect(showcaseServiceMock.findAll).toHaveBeenCalledWith(query, userId);
      expect(result).toEqual(mockPaginatedCards);
    });
  });

  describe("findMy", () => {
    it("делегирует вызов showcaseService.findMyCards с userId", async () => {
      const result = await controller.findMy(userId);

      expect(showcaseServiceMock.findMyCards).toHaveBeenCalledWith(userId);
      expect(result).toEqual([mockCard]);
    });
  });

  describe("create", () => {
    it("делегирует вызов showcaseService.create с userId и dto", async () => {
      const dto: CreateShowcaseCardDto = {
        title: "Ищу напарника для mock-собеседований",
        specialization: "FRONTEND",
        level: "MIDDLE",
        language: "RU",
        skills: ["React", "TypeScript"],
        bio: "Готовлюсь к собесам в бигтех",
        scheduleInfo: "По будням после 19:00",
        isUrgent: false,
        autoRenew: false,
      };

      const result = await controller.create(userId, dto);

      expect(showcaseServiceMock.create).toHaveBeenCalledWith(userId, dto);
      expect(result).toEqual(mockCard);
    });
  });

  describe("findOne", () => {
    it("делегирует вызов showcaseService.findOne с id", async () => {
      const result = await controller.findOne(cardId);

      expect(showcaseServiceMock.findOne).toHaveBeenCalledWith(cardId);
      expect(result).toEqual(mockCard);
    });
  });

  describe("update", () => {
    it("делегирует вызов showcaseService.update с id, userId и dto", async () => {
      const dto: UpdateShowcaseCardDto = {
        title: "Обновленный заголовок",
      };

      const result = await controller.update(cardId, userId, dto);

      expect(showcaseServiceMock.update).toHaveBeenCalledWith(
        cardId,
        userId,
        dto,
      );
      expect(result).toEqual(mockCard);
    });
  });

  describe("updateStatus", () => {
    it("делегирует вызов showcaseService.updateStatus с id, userId и dto", async () => {
      const dto: UpdateShowcaseCardStatusDto = {
        status: "INACTIVE",
      };

      const result = await controller.updateStatus(cardId, userId, dto);

      expect(showcaseServiceMock.updateStatus).toHaveBeenCalledWith(
        cardId,
        userId,
        dto,
      );
      expect(result.status).toBe("INACTIVE");
    });
  });

  describe("bump", () => {
    it("делегирует вызов showcaseService.bump с id и userId", async () => {
      const result = await controller.bump(cardId, userId);

      expect(showcaseServiceMock.bump).toHaveBeenCalledWith(cardId, userId);
      expect(result).toEqual(mockCard);
    });
  });

  describe("renew", () => {
    it("делегирует вызов showcaseService.renew с id и userId", async () => {
      const result = await controller.renew(cardId, userId);

      expect(showcaseServiceMock.renew).toHaveBeenCalledWith(cardId, userId);
      expect(result).toEqual(mockCard);
    });
  });

  describe("remove", () => {
    it("делегирует вызов showcaseService.remove с id и userId", async () => {
      const result = await controller.remove(cardId, userId);

      expect(showcaseServiceMock.remove).toHaveBeenCalledWith(cardId, userId);
      expect(result).toBeUndefined();
    });
  });
});
