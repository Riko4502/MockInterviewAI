import { NotFoundException } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
import { SecurityEventType } from "../../generated/prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import { SecurityEventsService } from "./security-events.service";

describe("SecurityEventsService", () => {
  let prismaMock: {
    securityEvent: {
      create: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
      count: jest.Mock;
    };
  };
  let service: SecurityEventsService;

  const EVENT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const USER_ID = "11111111-1111-4111-a111-111111111111";

  beforeEach(() => {
    prismaMock = {
      securityEvent: {
        create: jest.fn().mockResolvedValue({
          id: EVENT_ID,
          createdAt: new Date("2026-09-10T12:00:00.000Z"),
        }),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    service = new SecurityEventsService(prismaMock as unknown as PrismaService);
  });

  describe("record", () => {
    it("пишет событие в транзакции вызывающего, если она передана (ADR-005:95)", async () => {
      // Отдельный мок: доказывает, что запись идёт через tx, а не через PrismaService.
      const txCreate = jest.fn().mockResolvedValue({
        id: EVENT_ID,
        createdAt: new Date("2026-09-10T12:00:00.000Z"),
      });
      const tx = {
        securityEvent: { create: txCreate },
      } as unknown as Prisma.TransactionClient;

      const result = await service.record({
        tx,
        userId: USER_ID,
        type: SecurityEventType.TG_UNLINKED,
        ipAddress: "203.0.113.7",
        userAgent: "Mozilla/5.0",
        metadata: { channel: "web" },
      });

      expect(txCreate).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          type: SecurityEventType.TG_UNLINKED,
          ipAddress: "203.0.113.7",
          userAgent: "Mozilla/5.0",
          metadata: { channel: "web" },
        },
        select: { id: true, createdAt: true },
      });
      // Внешний клиент не используется — запись обязана быть в транзакции.
      expect(prismaMock.securityEvent.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: EVENT_ID,
        createdAt: new Date("2026-09-10T12:00:00.000Z"),
      });
    });

    it("пишет через PrismaService, если транзакция не передана", async () => {
      await service.record({
        userId: USER_ID,
        type: SecurityEventType.TG_LINKED,
      });

      expect(prismaMock.securityEvent.create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          type: SecurityEventType.TG_LINKED,
          ipAddress: null,
          userAgent: null,
        },
        select: { id: true, createdAt: true },
      });
    });

    it("не создаёт metadata-ключ, когда metadata не передан", async () => {
      await service.record({
        userId: USER_ID,
        type: SecurityEventType.GITHUB_UNLINKED,
        metadata: null,
      });

      const data = prismaMock.securityEvent.create.mock.calls[0][0].data;
      expect(data).not.toHaveProperty("metadata");
    });
  });

  describe("getUnseen", () => {
    it("выбирает непросмотренные и недоставленные события, новые впереди", async () => {
      prismaMock.securityEvent.findMany.mockResolvedValue([
        {
          id: EVENT_ID,
          type: SecurityEventType.TG_UNLINKED,
          createdAt: new Date("2026-09-10T12:00:00.000Z"),
        },
      ]);

      const result = await service.getUnseen(USER_ID);

      expect(prismaMock.securityEvent.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, seenAt: null, notifiedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, createdAt: true },
      });
      expect(result).toEqual({
        items: [
          {
            id: EVENT_ID,
            type: SecurityEventType.TG_UNLINKED,
            createdAt: "2026-09-10T12:00:00.000Z",
          },
        ],
      });
    });

    it("не отдаёт ipAddress/userAgent наружу (ADR-005:123-128, D12)", async () => {
      prismaMock.securityEvent.findMany.mockResolvedValue([
        {
          id: EVENT_ID,
          type: SecurityEventType.GITHUB_UNLINKED,
          createdAt: new Date("2026-09-10T12:00:00.000Z"),
        },
      ]);

      const { items } = await service.getUnseen(USER_ID);

      expect(Object.keys(items[0]).sort()).toEqual(["createdAt", "id", "type"]);
    });

    it("возвращает пустой список, если непросмотренных нет", async () => {
      const result = await service.getUnseen(USER_ID);

      expect(result).toEqual({ items: [] });
    });
  });

  describe("markSeen", () => {
    it("помечает непросмотренное событие просмотренным", async () => {
      prismaMock.securityEvent.updateMany.mockResolvedValue({ count: 1 });

      await service.markSeen(USER_ID, EVENT_ID);

      expect(prismaMock.securityEvent.updateMany).toHaveBeenCalledWith({
        where: { id: EVENT_ID, userId: USER_ID, seenAt: null },
        data: { seenAt: expect.any(Date) },
      });
      expect(prismaMock.securityEvent.count).not.toHaveBeenCalled();
    });

    it("идемпотентен: повторная отметка не превращается в 404", async () => {
      prismaMock.securityEvent.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.securityEvent.count.mockResolvedValue(1);

      await expect(
        service.markSeen(USER_ID, EVENT_ID),
      ).resolves.toBeUndefined();
      expect(prismaMock.securityEvent.count).toHaveBeenCalledWith({
        where: { id: EVENT_ID, userId: USER_ID },
      });
    });

    it("404, если событие не найдено или принадлежит другому пользователю", async () => {
      prismaMock.securityEvent.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.securityEvent.count.mockResolvedValue(0);

      await expect(service.markSeen(USER_ID, EVENT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
