import * as fs from "node:fs";
import * as path from "node:path";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import {
  REALTIME_SEED_TASK_DOC_LUA_RELATIVE_PATH,
  SEED_TASK_DOC_LUA,
  SessionsService,
} from "./sessions.service";

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
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let redisMock: {
    set: jest.Mock;
    get: jest.Mock;
    hset: jest.Mock;
    hdel: jest.Mock;
    exists: jest.Mock;
    publish: jest.Mock;
    delete: jest.Mock;
    eval: jest.Mock;
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
      $queryRaw: jest.fn().mockResolvedValue([{ id: sessionId }]),
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: (tx: unknown) => unknown) =>
          cb(prismaMock),
        ),
    };
    redisMock = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      hset: jest.fn().mockResolvedValue(undefined),
      hdel: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(false),
      publish: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      eval: jest.fn().mockResolvedValue(1),
    };
    configMock = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === "sessions.mirrorTtlSeconds") return 7200;
        if (key === "jwt.accessSecret")
          return "test-jwt-secret-for-sessions-tests";
        return undefined;
      }),
    };

    service = new SessionsService(
      prismaMock as unknown as PrismaService,
      redisMock as unknown as RedisService,
      configMock as unknown as ConfigService,
    );
  });

  describe("createSession", () => {
    it("создаёт сессию, создатель = interviewer, сохраняет inviteToken в Redis и разогревает зеркало", async () => {
      prismaMock.interviewSession.create.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
      });

      const result = await service.createSession(ownerId);

      expect(result.sessionId).toBe(sessionId);
      expect(result.inviteToken).toHaveLength(64);
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
      expect(redisMock.set).toHaveBeenCalledWith(
        `session:${sessionId}:invite`,
        result.inviteToken,
        7200,
      );
      expect(redisMock.eval).toHaveBeenCalledWith(
        expect.any(String),
        2,
        `{session:${sessionId}}:seeded_tasks`,
        `{session:${sessionId}}:task:two-sum:typescript:updates`,
        "two-sum:typescript",
        expect.any(String),
        86400,
      );
    });

    it("успешно создаёт сессию, даже если сидинг Redis завершился ошибкой (lazy fallback)", async () => {
      prismaMock.interviewSession.create.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
      });
      redisMock.eval.mockRejectedValueOnce(
        new Error("Redis connection timeout"),
      );

      const result = await service.createSession(ownerId);

      expect(result.sessionId).toBe(sessionId);
      expect(result.inviteToken).toHaveLength(64);
    });
  });

  describe("seedTaskDoc", () => {
    it("вызывает seed_task_doc.lua со специальным taskKey и контентом", async () => {
      redisMock.eval.mockResolvedValue(1);

      const status = await service.seedTaskDoc(
        sessionId,
        "task-2:python",
        "def solution(): pass",
      );

      expect(status).toBe(1);
      expect(redisMock.eval).toHaveBeenCalledWith(
        expect.any(String),
        2,
        `{session:${sessionId}}:seeded_tasks`,
        `{session:${sessionId}}:task:task-2:python:updates`,
        "task-2:python",
        expect.any(String),
        86400,
      );
    });
  });

  describe("joinSession", () => {
    it("успешно присоединяет существующего кандидата без inviteToken", async () => {
      const activeToken = service.generateInviteToken(sessionId);
      redisMock.get.mockImplementation(async (key: string) => {
        if (key === `session:${sessionId}:invite`) return activeToken;
        return null;
      });

      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        status: "ACTIVE",
        participants: [{ userId: "candidate-1", role: "CANDIDATE" }],
      });

      const result = await service.joinSession(sessionId, "candidate-1");

      expect(result.role).toBe("CANDIDATE");
      expect(result.inviteToken).toBe(activeToken);
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(redisMock.eval).toHaveBeenCalledWith(
        expect.any(String),
        2,
        `session:${sessionId}:active`,
        `session:${sessionId}:members`,
        "true",
        "closed",
        "candidate-1",
        "CANDIDATE",
        7200,
      );
    });

    it("успешно регистрирует нового кандидата при наличии валидного inviteToken", async () => {
      const validToken = service.generateInviteToken(sessionId);
      redisMock.get.mockImplementation(async (key: string) => {
        if (key === `session:${sessionId}:invite`) return validToken;
        return null;
      });

      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        status: "ACTIVE",
        participants: [{ userId: ownerId, role: "INTERVIEWER" }],
      });
      prismaMock.interviewParticipant.upsert.mockResolvedValue({
        sessionId,
        userId: "guest-user",
        role: "CANDIDATE",
      });

      const result = await service.joinSession(
        sessionId,
        "guest-user",
        validToken,
      );

      expect(result.role).toBe("CANDIDATE");
      expect(result.inviteToken).toBe(validToken);
      expect(prismaMock.interviewParticipant.upsert).toHaveBeenCalledWith({
        where: { sessionId_userId: { sessionId, userId: "guest-user" } },
        create: {
          sessionId,
          userId: "guest-user",
          role: "CANDIDATE",
        },
        update: {},
      });
      expect(redisMock.eval).toHaveBeenCalledWith(
        expect.any(String),
        2,
        `session:${sessionId}:active`,
        `session:${sessionId}:members`,
        "true",
        "closed",
        "guest-user",
        "CANDIDATE",
        7200,
      );
    });

    it("бросает ForbiddenException если пользователь новый и inviteToken невалиден", async () => {
      const activeToken = service.generateInviteToken(sessionId);
      redisMock.get.mockImplementation(async (key: string) => {
        if (key === `session:${sessionId}:invite`) return activeToken;
        return null;
      });

      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        status: "ACTIVE",
        participants: [{ userId: ownerId, role: "INTERVIEWER" }],
      });

      await expect(
        service.joinSession(sessionId, "uninvited-user", "invalid-token-123"),
      ).rejects.toThrow(ForbiddenException);

      expect(redisMock.eval).not.toHaveBeenCalled();
    });

    it("бросает ForbiddenException если в комнате достигнут лимит участников (10)", async () => {
      const validToken = service.generateInviteToken(sessionId);
      const fullParticipants = Array.from({ length: 10 }, (_, i) => ({
        userId: `user-${i}`,
        role: "CANDIDATE",
      }));

      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        status: "ACTIVE",
        participants: fullParticipants,
      });

      await expect(
        service.joinSession(sessionId, "overflow-user", validToken),
      ).rejects.toThrow("Interview session is full");

      expect(prismaMock.interviewParticipant.upsert).not.toHaveBeenCalled();
    });

    it("возвращает существующую роль без изменения в БД (например INTERVIEWER)", async () => {
      const activeToken = service.generateInviteToken(sessionId);
      redisMock.get.mockImplementation(async (key: string) => {
        if (key === `session:${sessionId}:invite`) return activeToken;
        return null;
      });

      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        status: "ACTIVE",
        participants: [{ userId: ownerId, role: "INTERVIEWER" }],
      });

      const result = await service.joinSession(sessionId, ownerId);

      expect(result.role).toBe("INTERVIEWER");
      expect(result.inviteToken).toBe(activeToken);
      expect(prismaMock.interviewParticipant.upsert).not.toHaveBeenCalled();
      expect(redisMock.eval).toHaveBeenCalledWith(
        expect.any(String),
        2,
        `session:${sessionId}:active`,
        `session:${sessionId}:members`,
        "true",
        "closed",
        ownerId,
        "INTERVIEWER",
        7200,
      );
    });

    it("бросает ForbiddenException если статус сессии CLOSED", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        status: "CLOSED",
        participants: [],
      });

      await expect(
        service.joinSession(sessionId, "candidate-1"),
      ).rejects.toThrow(ForbiddenException);
      expect(prismaMock.interviewParticipant.upsert).not.toHaveBeenCalled();
    });

    it("бросает ForbiddenException и не перезаписывает Redis, если сессия закрыта в Redis (гонка с closeSession)", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        status: "ACTIVE",
        participants: [{ userId: "candidate-1", role: "CANDIDATE" }],
      });
      // Lua script returns 0 because active key is "closed"
      redisMock.eval.mockResolvedValue(0);

      await expect(
        service.joinSession(sessionId, "candidate-1"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("синхронизированный конкурентный тест (CWE-367): предотвращает TOCTOU-перезапись при порядке eval-get → closeSession → eval-set", async () => {
      let redisActiveValue = "true";
      let closeSessionExecuted = false;

      // Моделируем атомарное выполнение Lua-скрипта в Redis
      redisMock.eval.mockImplementation(
        async (
          _script: string,
          _numKeys: number,
          _activeKey: string,
          _membersKey: string,
          activeVal: string,
          closedVal: string,
        ) => {
          // Имитируем конкурентное закрытие сессии до фиксации в Redis
          if (!closeSessionExecuted) {
            closeSessionExecuted = true;
            redisActiveValue = closedVal;
          }

          if (redisActiveValue === closedVal) {
            return 0;
          }
          redisActiveValue = activeVal;
          return 1;
        },
      );

      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        status: "ACTIVE",
        participants: [{ userId: "candidate-1", role: "CANDIDATE" }],
      });

      await expect(
        service.joinSession(sessionId, "candidate-1"),
      ).rejects.toThrow("Session is closed");

      // Состояние в Redis остаётся закрытым и не перезаписано на "true"
      expect(redisActiveValue).toBe("closed");
    });

    it("бросает NotFoundException если сессия не найдена", async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);
      prismaMock.interviewSession.findUnique.mockResolvedValue(null);

      await expect(
        service.joinSession(sessionId, "candidate-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("бросает NotFoundException если передан невалидный UUID сессии", async () => {
      await expect(
        service.joinSession("invalid-uuid-string", "candidate-1"),
      ).rejects.toThrow(NotFoundException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("выполняет блокировку строки сессии через SELECT FOR UPDATE внутри транзакции", async () => {
      const validToken = service.generateInviteToken(sessionId);
      redisMock.get.mockImplementation(async (key: string) => {
        if (key === `session:${sessionId}:invite`) return validToken;
        return null;
      });

      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        status: "ACTIVE",
        participants: [{ userId: ownerId, role: "INTERVIEWER" }],
      });
      prismaMock.interviewParticipant.upsert.mockResolvedValue({
        sessionId,
        userId: "cand-1",
        role: "CANDIDATE",
      });

      await service.joinSession(sessionId, "cand-1", validToken);

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
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
    it("удаляет участника из Postgres, зеркала, публикует ревокацию и ротирует inviteToken (CWE-613)", async () => {
      const callOrder: string[] = [];
      prismaMock.$queryRaw.mockImplementation(async () => {
        callOrder.push("queryRaw-for-update");
        return [{ id: sessionId }];
      });
      redisMock.set.mockImplementation(async () => {
        callOrder.push("redis-set-invite");
      });
      prismaMock.interviewParticipant.delete.mockImplementation(async () => {
        callOrder.push("prisma-delete");
        return {};
      });
      redisMock.hdel.mockImplementation(async () => {
        callOrder.push("redis-hdel");
      });
      redisMock.publish.mockImplementation(async () => {
        callOrder.push("redis-publish-revocation");
      });

      await service.removeParticipant(sessionId, "u-9");

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(prismaMock.interviewParticipant.delete).toHaveBeenCalledWith({
        where: { sessionId_userId: { sessionId, userId: "u-9" } },
      });
      expect(redisMock.hdel).toHaveBeenCalledWith(
        `session:${sessionId}:members`,
        "u-9",
        7200,
      );
      expect(redisMock.publish).toHaveBeenCalledWith(
        "auth:revocations",
        expect.stringContaining(`"data":"u-9"`),
      );
      expect(redisMock.set).toHaveBeenCalledWith(
        `session:${sessionId}:invite`,
        expect.any(String),
        7200,
      );
      expect(callOrder).toEqual([
        "queryRaw-for-update",
        "redis-set-invite",
        "prisma-delete",
        "redis-hdel",
        "redis-publish-revocation",
      ]);
    });

    it("бросает NotFoundException если передан невалидный UUID сессии", async () => {
      await expect(
        service.removeParticipant("invalid-uuid", "u-9"),
      ).rejects.toThrow(NotFoundException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("бросает NotFoundException если сессия не найдена при FOR UPDATE", async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);

      await expect(service.removeParticipant(sessionId, "u-9")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("удалённый участник не может повторно присоединиться по старому inviteToken (CWE-613)", async () => {
      let activeInvite =
        "1111111111111111111111111111111111111111111111111111111111111111";
      redisMock.get.mockImplementation(async (key: string) => {
        if (key === `session:${sessionId}:invite`) return activeInvite;
        return null;
      });
      redisMock.set.mockImplementation(async (key: string, value: string) => {
        if (key === `session:${sessionId}:invite`) {
          activeInvite = value;
        }
      });

      prismaMock.interviewParticipant.delete.mockResolvedValue({});
      await service.removeParticipant(sessionId, "kicked-candidate");

      expect(activeInvite).not.toBe(
        "1111111111111111111111111111111111111111111111111111111111111111",
      );

      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        status: "ACTIVE",
        participants: [{ userId: ownerId, role: "INTERVIEWER" }],
      });

      await expect(
        service.joinSession(
          sessionId,
          "kicked-candidate",
          "1111111111111111111111111111111111111111111111111111111111111111",
        ),
      ).rejects.toThrow("User is not invited to this interview session");
    });
  });

  describe("rotateInviteToken", () => {
    it("ротирует inviteToken в Redis и возвращает новый токен", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        status: "ACTIVE",
      });

      const result = await service.rotateInviteToken(sessionId);

      expect(result.inviteToken).toHaveLength(64);
      expect(redisMock.set).toHaveBeenCalledWith(
        `session:${sessionId}:invite`,
        result.inviteToken,
        7200,
      );
    });

    it("бросает NotFoundException если сессия не существует", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue(null);

      await expect(service.rotateInviteToken(sessionId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("бросает ForbiddenException если сессия закрыта", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        status: "CLOSED",
      });

      await expect(service.rotateInviteToken(sessionId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("closeSession", () => {
    it("закрывает сессию, публикует room-scoped ревокации и удаляет inviteToken", async () => {
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
      expect(redisMock.delete).toHaveBeenCalledWith(
        `session:${sessionId}:invite`,
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

  describe("SEED_TASK_DOC_LUA contract with apps/realtime", () => {
    it("соответствует seed_task_doc.lua из apps/realtime", () => {
      const realtimeScriptPath = path.resolve(
        __dirname,
        REALTIME_SEED_TASK_DOC_LUA_RELATIVE_PATH,
      );
      expect(fs.existsSync(realtimeScriptPath)).toBe(true);

      const realtimeContent = fs.readFileSync(realtimeScriptPath, "utf-8");

      const normalize = (script: string) =>
        script
          .replace(/\r\n/g, "\n")
          .replace(/--[^\n]*/g, "") // Удаляем однострочные комментарии Lua
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .join("\n");

      // Проверяем, что загруженный SEED_TASK_DOC_LUA и исходный файл из realtime логически идентичны
      expect(normalize(SEED_TASK_DOC_LUA)).toBe(normalize(realtimeContent));
    });
  });
});
