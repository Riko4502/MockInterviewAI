import { NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
import type { RedisService } from "../../redis/redis.service";
import { SessionsService } from "./sessions.service";

describe("SessionsService", () => {
  let prismaMock: {
    interviewSession: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    interviewParticipant: {
      upsert: jest.Mock;
      delete: jest.Mock;
    };
  };
  let redisMock: {
    set: jest.Mock;
    hset: jest.Mock;
    hdel: jest.Mock;
    exists: jest.Mock;
    publish: jest.Mock;
  };
  let configMock: { get: jest.Mock };
  let service: SessionsService;

  const sessionId = "11111111-1111-4111-a111-111111111111";
  const ownerId = "22222222-2222-4222-b222-222222222222";

  beforeEach(() => {
    prismaMock = {
      interviewSession: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      interviewParticipant: {
        upsert: jest.fn(),
        delete: jest.fn(),
      },
    };
    redisMock = {
      set: jest.fn().mockResolvedValue(undefined),
      hset: jest.fn().mockResolvedValue(undefined),
      hdel: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(false),
      publish: jest.fn().mockResolvedValue(undefined),
    };
    configMock = { get: jest.fn().mockReturnValue(7200) };

    service = new SessionsService(
      prismaMock as unknown as PrismaService,
      redisMock as unknown as RedisService,
      configMock as unknown as ConfigService,
    );
  });

  describe("createSession", () => {
    it("создаёт сессию, создатель = interviewer, разогревает зеркало", async () => {
      prismaMock.interviewSession.create.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
      });

      const result = await service.createSession(ownerId);

      expect(result).toEqual({ sessionId });
      expect(prismaMock.interviewSession.create).toHaveBeenCalledWith({
        data: {
          userId: ownerId,
          participants: {
            create: { userId: ownerId, role: "INTERVIEWER" },
          },
        },
      });
      expect(redisMock.set).toHaveBeenCalledWith(
        `session:${sessionId}:active`,
        "true",
        7200,
      );
      expect(redisMock.hset).toHaveBeenCalledWith(
        `session:${sessionId}:members`,
        ownerId,
        "INTERVIEWER",
        7200,
      );
    });
  });

  describe("addParticipant", () => {
    it("upsert-ит участника в Postgres и пишет в зеркало", async () => {
      prismaMock.interviewParticipant.upsert.mockResolvedValue({});

      await service.addParticipant(sessionId, "u-9", "CANDIDATE");

      expect(prismaMock.interviewParticipant.upsert).toHaveBeenCalledWith({
        where: { sessionId_userId: { sessionId, userId: "u-9" } },
        create: { sessionId, userId: "u-9", role: "CANDIDATE" },
        update: { role: "CANDIDATE" },
      });
      expect(redisMock.hset).toHaveBeenCalledWith(
        `session:${sessionId}:members`,
        "u-9",
        "CANDIDATE",
        7200,
      );
    });
  });

  describe("removeParticipant", () => {
    it("удаляет участника из Postgres и зеркала", async () => {
      prismaMock.interviewParticipant.delete.mockResolvedValue({});

      await service.removeParticipant(sessionId, "u-9");

      expect(prismaMock.interviewParticipant.delete).toHaveBeenCalledWith({
        where: { sessionId_userId: { sessionId, userId: "u-9" } },
      });
      expect(redisMock.hdel).toHaveBeenCalledWith(
        `session:${sessionId}:members`,
        "u-9",
        7200,
      );
    });
  });

  describe("closeSession", () => {
    it("закрывает сессию и публикует room-scoped ревокации по участникам", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
        participants: [
          { userId: "u-1", role: "INTERVIEWER" },
          { userId: "u-2", role: "CANDIDATE" },
        ],
      });
      prismaMock.interviewSession.update.mockResolvedValue({});

      await service.closeSession(sessionId);

      expect(prismaMock.interviewSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { status: "CLOSED", endedAt: expect.any(Date) },
      });
      expect(redisMock.set).toHaveBeenCalledWith(
        `session:${sessionId}:active`,
        "closed",
        7200,
      );
      expect(redisMock.publish).toHaveBeenCalledTimes(2);
      expect(redisMock.publish.mock.calls[0]).toEqual([
        "auth:revocations",
        expect.stringContaining(`"data":"u-1"`),
      ]);
      expect(redisMock.publish.mock.calls[0][1]).toEqual(
        expect.stringContaining(`"sessionId":"${sessionId}"`),
      );
    });

    it("бросает NotFoundException если сессия не существует", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue(null);

      await expect(service.closeSession(sessionId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getOwner", () => {
    it("возвращает владельца сессии", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        userId: ownerId,
      });

      await expect(service.getOwner(sessionId)).resolves.toBe(ownerId);
    });

    it("бросает NotFoundException для несуществующей сессии", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue(null);

      await expect(service.getOwner(sessionId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("reconcileMirrors", () => {
    it("восстанавливает зеркало ACTIVE-сессий из Postgres", async () => {
      prismaMock.interviewSession.findMany.mockResolvedValue([
        {
          id: sessionId,
          userId: ownerId,
          status: "ACTIVE",
          participants: [{ userId: ownerId, role: "INTERVIEWER" }],
        },
      ]);

      await service.reconcileMirrors();

      expect(redisMock.set).toHaveBeenCalledWith(
        `session:${sessionId}:active`,
        "true",
        7200,
      );
      expect(redisMock.hset).toHaveBeenCalledWith(
        `session:${sessionId}:members`,
        ownerId,
        "INTERVIEWER",
        7200,
      );
    });

    it("не падает при ошибке Postgres", async () => {
      prismaMock.interviewSession.findMany.mockRejectedValue(
        new Error("db down"),
      );

      await expect(service.reconcileMirrors()).resolves.toBeUndefined();
    });
  });
});
