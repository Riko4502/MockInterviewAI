import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import { ShowcaseService } from "./showcase.service";

describe("ShowcaseService", () => {
  let service: ShowcaseService;
  let prismaMock: {
    user: {
      findUnique: jest.Mock;
    };
    showcaseCard: {
      count: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    matchRequest: {
      groupBy: jest.Mock;
    };
  };

  const userId = "11111111-1111-4111-a111-111111111111";

  const validDto = {
    title: "Ищу напарника для mock-собеседований по React",
    specialization: "FRONTEND" as const,
    level: "MIDDLE" as const,
    language: "RU" as const,
    skills: ["React", "TypeScript"],
    bio: "Готовлюсь к собесам в бигтех",
    scheduleInfo: "По будням после 19:00",
    isUrgent: false,
    autoRenew: false,
  };

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
      },
      showcaseCard: {
        count: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      matchRequest: {
        groupBy: jest.fn(),
      },
    };

    service = new ShowcaseService(prismaMock as unknown as PrismaService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("бросает NotFoundException, если пользователь не найден", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.create(userId, validDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("бросает BadRequestException, если имя или никнейм не заполнены", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        displayName: "A",
        username: null,
      });

      await expect(service.create(userId, validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("бросает BadRequestException, если достигнут лимит в 5 активных карточек", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        displayName: "John Doe",
        username: "johndoe",
      });
      prismaMock.showcaseCard.count.mockResolvedValue(5);

      await expect(service.create(userId, validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("бросает ConflictException, если уже есть активная карточка с таким стеком и грейдом", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        displayName: "John Doe",
        username: "johndoe",
      });
      prismaMock.showcaseCard.count.mockResolvedValue(2);
      prismaMock.showcaseCard.findFirst.mockResolvedValue({ id: "card-id-1" });

      await expect(service.create(userId, validDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it("бросает ConflictException при ошибке уникальности P2002 от Prisma (защита от race condition)", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        displayName: "John Doe",
        username: "johndoe",
      });
      prismaMock.showcaseCard.count.mockResolvedValue(0);
      prismaMock.showcaseCard.findFirst.mockResolvedValue(null);

      const p2002Error = new Error("Unique constraint failed");
      (p2002Error as unknown as { code: string }).code = "P2002";
      prismaMock.showcaseCard.create.mockRejectedValue(p2002Error);

      await expect(service.create(userId, validDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it("успешно создаёт карточку со сроком жизни на 15 дней", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        displayName: "John Doe",
        username: "johndoe",
        avatarUrl: null,
        telegramUsername: "tg_john",
        gitUrl: null,
      });
      prismaMock.showcaseCard.count.mockResolvedValue(0);
      prismaMock.showcaseCard.findFirst.mockResolvedValue(null);

      const createdCard = {
        id: "new-card-id",
        userId,
        ...validDto,
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        user: {
          id: userId,
          displayName: "John Doe",
          username: "johndoe",
          avatarUrl: null,
          telegramUsername: "tg_john",
          gitUrl: null,
        },
      };
      prismaMock.showcaseCard.create.mockResolvedValue(createdCard);

      const result = await service.create(userId, validDto);

      expect(result).toEqual(createdCard);
      expect(prismaMock.showcaseCard.create).toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("бросает NotFoundException, если карточка не найдена", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue(null);

      await expect(service.findOne("non-existent-id")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("возвращает карточку со скрытым telegramUsername", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue({
        id: "card-1",
        userId,
        title: "Test",
        status: "ACTIVE",
        user: {
          id: userId,
          displayName: "User",
          telegramUsername: "secret_tg",
        },
      });

      const result = await service.findOne("card-1");

      expect(result.id).toBe("card-1");
      expect(result.user.telegramUsername).toBeNull();
    });

    it("бросает NotFoundException, если карточка не активна и запрашивается другим пользователем", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue({
        id: "card-1",
        userId: "owner-id",
        title: "Test",
        status: "INACTIVE",
        user: {
          id: "owner-id",
          displayName: "Owner",
          telegramUsername: "owner_tg",
        },
      });

      await expect(service.findOne("card-1", "stranger-id")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("remove", () => {
    it("бросает NotFoundException, если карточка не найдена", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue(null);

      await expect(service.remove("card-1", userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("бросает ForbiddenException, если удаляет не автор", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue({
        id: "card-1",
        userId: "other-user",
      });

      await expect(service.remove("card-1", userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("успешно удаляет карточку автора", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue({
        id: "card-1",
        userId,
      });
      prismaMock.showcaseCard.delete.mockResolvedValue({ id: "card-1" });

      await expect(service.remove("card-1", userId)).resolves.not.toThrow();
      expect(prismaMock.showcaseCard.delete).toHaveBeenCalledWith({
        where: { id: "card-1" },
      });
    });
  });

  describe("bump", () => {
    it("бросает BadRequestException, если с момента прошлого бампа прошло менее 24ч", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue({
        id: "card-1",
        userId,
        status: "ACTIVE",
        bumpedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 часа назад
      });

      await expect(service.bump("card-1", userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("успешно бампает карточку, если прошло более 24ч", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue({
        id: "card-1",
        userId,
        status: "ACTIVE",
        bumpedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 часов назад
      });
      prismaMock.showcaseCard.update.mockResolvedValue({
        id: "card-1",
        bumpedAt: new Date(),
      });

      const result = await service.bump("card-1", userId);

      expect(result).toBeDefined();
      expect(prismaMock.showcaseCard.update).toHaveBeenCalled();
    });
  });

  describe("renew", () => {
    it("бросает BadRequestException, если статус не EXPIRED", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue({
        id: "card-1",
        userId,
        status: "ACTIVE",
      });

      await expect(service.renew("card-1", userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("успешно перепубликует истекшую карточку", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue({
        id: "card-1",
        userId,
        status: "EXPIRED",
      });
      prismaMock.showcaseCard.count.mockResolvedValue(1);
      prismaMock.showcaseCard.update.mockResolvedValue({
        id: "card-1",
        status: "ACTIVE",
      });

      const result = await service.renew("card-1", userId);

      expect(result).toBeDefined();
      expect(prismaMock.showcaseCard.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "ACTIVE" }),
        }),
      );
    });
  });

  describe("findMyCards", () => {
    it("возвращает пустой массив, если у пользователя нет карточек", async () => {
      prismaMock.showcaseCard.findMany.mockResolvedValue([]);

      const result = await service.findMyCards(userId);

      expect(result).toEqual([]);
    });

    it("возвращает карточки с посчитанной статистикой заявок", async () => {
      prismaMock.showcaseCard.findMany.mockResolvedValue([
        { id: "card-1", userId },
      ]);
      prismaMock.matchRequest.groupBy.mockResolvedValue([
        { targetCardId: "card-1", status: "PENDING", _count: { _all: 3 } },
        { targetCardId: "card-1", status: "ACCEPTED", _count: { _all: 1 } },
      ]);

      const result = await service.findMyCards(userId);

      expect(result).toHaveLength(1);
      expect(result[0].stats).toEqual({
        pendingRequestsCount: 3,
        acceptedRequestsCount: 1,
      });
    });
  });

  describe("findAll", () => {
    it("возвращает пагинированный список карточек для неавторизованного пользователя", async () => {
      prismaMock.showcaseCard.count.mockResolvedValue(1);
      prismaMock.showcaseCard.findMany.mockResolvedValue([
        {
          id: "card-1",
          userId: "other-user",
          user: { telegramUsername: "secret" },
        },
      ]);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        sortBy: "BUMPED",
      });

      expect(prismaMock.showcaseCard.count).toHaveBeenCalledWith({
        where: {
          status: "ACTIVE",
        },
      });
      expect(prismaMock.showcaseCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: "ACTIVE",
          },
          skip: 0,
          take: 10,
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].user.telegramUsername).toBeNull();
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it("исключает карточки текущего авторизованного пользователя из выдачи", async () => {
      prismaMock.showcaseCard.count.mockResolvedValue(1);
      prismaMock.showcaseCard.findMany.mockResolvedValue([
        {
          id: "card-2",
          userId: "other-user",
          user: { telegramUsername: "secret" },
        },
      ]);

      const currentUserId = "my-user-id";
      const result = await service.findAll(
        {
          page: 1,
          limit: 10,
          sortBy: "BUMPED",
        },
        currentUserId,
      );

      expect(prismaMock.showcaseCard.count).toHaveBeenCalledWith({
        where: {
          status: "ACTIVE",
          userId: { not: currentUserId },
        },
      });
      expect(prismaMock.showcaseCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: "ACTIVE",
            userId: { not: currentUserId },
          },
          skip: 0,
          take: 10,
        }),
      );
      expect(result.data).toHaveLength(1);
    });

    it("корректно обрабатывает поиск по навыкам со спецсимволами и LIKE-экранированием", async () => {
      prismaMock.showcaseCard.count.mockResolvedValue(1);
      prismaMock.showcaseCard.findMany.mockResolvedValue([
        {
          id: "card-3",
          userId: "other-user",
          user: { telegramUsername: "secret" },
        },
      ]);

      await service.findAll({
        page: 1,
        limit: 10,
        search: "+node_js -vue_3 middle_dev 100%",
        sortBy: "BUMPED",
      });

      expect(prismaMock.showcaseCard.count).toHaveBeenCalledWith({
        where: {
          status: "ACTIVE",
          AND: [
            { skills: { hasEvery: ["node_js"] } },
            { NOT: { skills: { hasSome: ["vue_3"] } } },
            {
              OR: [
                { title: { contains: "middle\\_dev", mode: "insensitive" } },
                { bio: { contains: "middle\\_dev", mode: "insensitive" } },
                { skills: { has: "middle_dev" } },
              ],
            },
            {
              OR: [
                { title: { contains: "100\\%", mode: "insensitive" } },
                { bio: { contains: "100\\%", mode: "insensitive" } },
                { skills: { has: "100%" } },
              ],
            },
          ],
        },
      });
    });
  });
});
