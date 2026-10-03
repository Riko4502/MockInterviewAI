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
    availabilitySlot: {
      createManyAndReturn: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const userId = "11111111-1111-4111-a111-111111111111";

  /**
   * Даты записи Prisma. Маппер `toShowcaseCardResponse` вызывает
   * `toISOString()` на каждой из них, поэтому в моках они обязаны быть
   * настоящими `Date`, а не заглушками.
   */
  const cardTimestamps = {
    bumpedAt: new Date("2026-01-01T10:00:00.000Z"),
    expiresAt: new Date("2026-01-16T10:00:00.000Z"),
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: new Date("2026-01-01T10:00:00.000Z"),
  };

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
      availabilitySlot: {
        createManyAndReturn: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    service = new ShowcaseService(prismaMock as unknown as PrismaService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  const createdCard = {
    id: "new-card-id",
    userId,
    ...validDto,
    status: "ACTIVE",
    ...cardTimestamps,
    slots: [],
    user: {
      id: userId,
      displayName: "John Doe",
      username: "johndoe",
      avatarUrl: null,
      telegramUsername: "tg_john",
      gitUrl: null,
    },
  };

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
      prismaMock.showcaseCard.create.mockResolvedValue(createdCard);

      const result = await service.create(userId, validDto);

      expect(result).toEqual({
        ...createdCard,
        bumpedAt: cardTimestamps.bumpedAt.toISOString(),
        expiresAt: cardTimestamps.expiresAt.toISOString(),
        createdAt: cardTimestamps.createdAt.toISOString(),
        updatedAt: cardTimestamps.updatedAt.toISOString(),
      });
      expect(prismaMock.showcaseCard.create).toHaveBeenCalled();
    });

    it("переводит слоты в зоне владельца и возвращает их вместе с анкетой", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        displayName: "John Doe",
        username: "johndoe",
        avatarUrl: null,
        telegramUsername: "tg_john",
        gitUrl: null,
        timezone: "Europe/Moscow",
      });
      prismaMock.showcaseCard.count.mockResolvedValue(0);
      prismaMock.showcaseCard.findFirst.mockResolvedValue(null);

      prismaMock.showcaseCard.create.mockResolvedValue(createdCard);

      // 19:00 Europe/Moscow — это 16:00Z.
      const insertedSlot = {
        id: "slot-1",
        cardId: "new-card-id",
        startsAt: new Date("2026-10-10T16:00:00.000Z"),
        endsAt: new Date("2026-10-10T17:00:00.000Z"),
        durationMinutes: 60,
        status: "OPEN",
        bookedByRequestId: null,
      };
      prismaMock.availabilitySlot.createManyAndReturn.mockResolvedValueOnce([
        insertedSlot,
      ]);

      const result = await service.create(userId, {
        ...validDto,
        slots: [{ startsAtLocal: "2026-10-10T19:00" }],
      });

      expect(
        prismaMock.availabilitySlot.createManyAndReturn,
      ).toHaveBeenCalledWith({
        data: [
          {
            cardId: "new-card-id",
            startsAt: insertedSlot.startsAt,
            endsAt: insertedSlot.endsAt,
            durationMinutes: 60,
          },
        ],
      });
      expect(result.slots).toEqual([
        {
          id: "slot-1",
          startsAt: "2026-10-10T16:00:00.000Z",
          durationMinutes: 60,
          status: "OPEN",
        },
      ]);
      // Слоты вытесняют свободный текст о расписании (ADR-002:63).
      expect(result.scheduleInfo).toBeNull();
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
        ...cardTimestamps,
        slots: [],
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

  describe("update", () => {
    /**
     * 19:00 Europe/Moscow — это 16:00Z. Слоты в моках заданы UTC-инстантами,
     * потому что в базу попадает именно он, а локальное время приходит только
     * на проводе.
     */
    const slotAt19 = new Date("2026-12-01T16:00:00.000Z");
    const slotAt20 = new Date("2026-12-01T17:00:00.000Z");

    const openSlot = {
      id: "slot-open-19",
      cardId: "card-1",
      startsAt: slotAt19,
      endsAt: new Date("2026-12-01T17:00:00.000Z"),
      durationMinutes: 60,
      status: "OPEN",
      bookedByRequestId: null,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    };

    const bookedSlot = {
      ...openSlot,
      id: "slot-booked-20",
      startsAt: slotAt20,
      endsAt: new Date("2026-12-01T18:00:00.000Z"),
      status: "BOOKED",
      bookedByRequestId: "request-1",
    };

    const cardWithSlots = (slots: unknown[]) => ({
      id: "card-1",
      userId,
      status: "ACTIVE",
      specialization: "FRONTEND",
      level: "MIDDLE",
      ...cardTimestamps,
      expiresAt: new Date("2026-12-10T10:00:00.000Z"),
      slots,
    });

    const savedCard = (slots: unknown[]) => ({
      id: "card-1",
      userId,
      title: "Новое название",
      status: "ACTIVE",
      ...cardTimestamps,
      expiresAt: new Date("2026-12-10T10:00:00.000Z"),
      slots,
      user: { id: userId, telegramUsername: "tg" },
    });

    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        timezone: "Europe/Moscow",
      });
    });

    it("бросает NotFoundException, если карточка не найдена", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue(null);

      await expect(
        service.update("card-1", userId, { title: "Новое название" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("бросает ForbiddenException, если редактирует не автор", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue(
        cardWithSlots([openSlot]),
      );

      await expect(
        service.update("card-1", "another-user", { title: "Новое название" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("не трогает расписание, если поле slots не прислано", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue(
        cardWithSlots([openSlot]),
      );
      prismaMock.showcaseCard.update.mockResolvedValue(savedCard([openSlot]));

      const result = await service.update("card-1", userId, {
        title: "Новое название",
      });

      expect(prismaMock.availabilitySlot.updateMany).not.toHaveBeenCalled();
      expect(
        prismaMock.availabilitySlot.createManyAndReturn,
      ).not.toHaveBeenCalled();
      expect(result.title).toBe("Новое название");
    });

    it("гасит удалённые слоты, сохраняет совпавшие и создаёт новые", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue(
        cardWithSlots([openSlot]),
      );

      const newSlot = {
        id: "slot-new-21",
        cardId: "card-1",
        startsAt: new Date("2026-12-01T18:00:00.000Z"), // 21:00 MSK
        endsAt: new Date("2026-12-01T19:00:00.000Z"),
        durationMinutes: 60,
        status: "OPEN",
        bookedByRequestId: null,
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
        updatedAt: new Date("2026-01-01T10:00:00.000Z"),
      };
      prismaMock.availabilitySlot.createManyAndReturn.mockResolvedValueOnce([
        newSlot,
      ]);
      prismaMock.showcaseCard.update.mockResolvedValue(
        savedCard([openSlot, newSlot]),
      );

      const result = await service.update("card-1", userId, {
        slots: [
          { startsAtLocal: "2026-12-01T19:00" },
          { startsAtLocal: "2026-12-01T21:00" },
        ],
      });

      // 19:00 остаётся тем же слотом, а не вставляется заново.
      expect(
        prismaMock.availabilitySlot.createManyAndReturn,
      ).toHaveBeenCalledWith({
        data: [
          {
            cardId: "card-1",
            startsAt: newSlot.startsAt,
            endsAt: newSlot.endsAt,
            durationMinutes: 60,
          },
        ],
      });
      expect(prismaMock.availabilitySlot.updateMany).not.toHaveBeenCalled();
      expect(result.slots.map((slot) => slot.id)).toEqual([
        "slot-open-19",
        "slot-new-21",
      ]);
    });

    it("гасит снятые владельцем слоты при полной пересборке", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue(
        cardWithSlots([openSlot]),
      );
      prismaMock.availabilitySlot.createManyAndReturn.mockResolvedValueOnce([]);
      prismaMock.showcaseCard.update.mockResolvedValue(savedCard([]));

      await service.update("card-1", userId, {
        slots: [{ startsAtLocal: "2026-12-01T21:00" }],
      });

      expect(prismaMock.availabilitySlot.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["slot-open-19"] }, status: "OPEN" },
        data: { status: "CANCELLED" },
      });
    });

    it("не трогает слот, занятый заявкой", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue(
        cardWithSlots([openSlot, bookedSlot]),
      );
      prismaMock.availabilitySlot.createManyAndReturn.mockResolvedValueOnce([]);
      prismaMock.showcaseCard.update.mockResolvedValue(savedCard([openSlot]));

      const result = await service.update("card-1", userId, {
        slots: [{ startsAtLocal: "2026-12-01T19:00" }],
      });

      expect(prismaMock.availabilitySlot.updateMany).not.toHaveBeenCalled();
      expect(result.slots.map((slot) => slot.id)).toEqual(["slot-open-19"]);
    });

    it("бросает ConflictException, если новый слот пересекается с занятым заявкой", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue(
        cardWithSlots([bookedSlot]),
      );

      await expect(
        service.update("card-1", userId, {
          slots: [{ startsAtLocal: "2026-12-01T20:30" }],
        }),
      ).rejects.toThrow(ConflictException);

      expect(prismaMock.availabilitySlot.updateMany).not.toHaveBeenCalled();
      expect(
        prismaMock.availabilitySlot.createManyAndReturn,
      ).not.toHaveBeenCalled();
    });

    it("бросает BadRequestException, если у владельца не задана таймзона", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        timezone: null,
      });
      prismaMock.showcaseCard.findUnique.mockResolvedValue(
        cardWithSlots([openSlot]),
      );

      await expect(
        service.update("card-1", userId, {
          slots: [{ startsAtLocal: "2026-12-01T19:00" }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("бросает BadRequestException при конфликте сериализации P2034", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue(
        cardWithSlots([openSlot]),
      );

      const p2034 = Object.assign(new Error("Serialization conflict"), {
        code: "P2034",
      });
      prismaMock.$transaction.mockRejectedValueOnce(p2034);

      await expect(
        service.update("card-1", userId, { title: "Новое название" }),
      ).rejects.toThrow(ConflictException);
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

  describe("updateStatus", () => {
    it("бросает NotFoundException, если карточка не найдена", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus("card-1", userId, { status: "INACTIVE" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("бросает ForbiddenException, если пользователь не является автором", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue({
        id: "card-1",
        userId: "another-user",
        status: "ACTIVE",
        user: { id: "another-user", telegramUsername: "user_tg" },
      });

      await expect(
        service.updateStatus("card-1", userId, { status: "INACTIVE" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("бросает BadRequestException при попытке изменить статус EXPIRED карточки", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue({
        id: "card-1",
        userId,
        status: "EXPIRED",
        user: { id: userId, telegramUsername: "tg" },
      });

      await expect(
        service.updateStatus("card-1", userId, { status: "ACTIVE" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("возвращает карточку без мутации в базе, если статус совпадает с текущим (no-op)", async () => {
      const existingCard = {
        id: "card-1",
        userId,
        status: "ACTIVE",
        ...cardTimestamps,
        slots: [],
        user: { id: userId, telegramUsername: "tg" },
      };
      prismaMock.showcaseCard.findUnique.mockResolvedValue(existingCard);

      const result = await service.updateStatus("card-1", userId, {
        status: "ACTIVE",
      });

      expect(result.id).toBe("card-1");
      expect(result.bumpedAt).toBe(cardTimestamps.bumpedAt.toISOString());
      expect(prismaMock.showcaseCard.update).not.toHaveBeenCalled();
      expect(prismaMock.showcaseCard.count).not.toHaveBeenCalled();
    });

    it("бросает BadRequestException при переводе в ACTIVE, если достигнут лимит 5 активных анкет", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue({
        id: "card-1",
        userId,
        status: "INACTIVE",
        user: { id: userId, telegramUsername: "tg" },
      });
      prismaMock.showcaseCard.count.mockResolvedValue(5);

      await expect(
        service.updateStatus("card-1", userId, { status: "ACTIVE" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("успешно переводит карточку в новый статус при соблюдении всех правил", async () => {
      prismaMock.showcaseCard.findUnique.mockResolvedValue({
        id: "card-1",
        userId,
        status: "ACTIVE",
        ...cardTimestamps,
        slots: [],
        user: { id: userId, telegramUsername: "tg" },
      });
      const updatedCard = {
        id: "card-1",
        userId,
        status: "INACTIVE",
        ...cardTimestamps,
        slots: [],
        user: { id: userId, telegramUsername: "tg" },
      };
      prismaMock.showcaseCard.update.mockResolvedValue(updatedCard);

      const result = await service.updateStatus("card-1", userId, {
        status: "INACTIVE",
      });

      expect(result.status).toBe("INACTIVE");
      expect(prismaMock.showcaseCard.update).toHaveBeenCalledWith({
        where: { id: "card-1" },
        data: { status: "INACTIVE" },
        include: expect.any(Object),
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
        ...cardTimestamps,
        slots: [],
        user: { id: "other-user", telegramUsername: "tg" },
      });

      const result = await service.bump("card-1", userId);

      expect(result.bumpedAt).toBe(cardTimestamps.bumpedAt.toISOString());
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
        ...cardTimestamps,
        slots: [],
        user: { id: userId, telegramUsername: "tg" },
      });

      const result = await service.renew("card-1", userId);

      expect(result.status).toBe("ACTIVE");
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
        { id: "card-1", userId, ...cardTimestamps, slots: [] },
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
          ...cardTimestamps,
          slots: [],
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
          ...cardTimestamps,
          slots: [],
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
          ...cardTimestamps,
          slots: [],
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
