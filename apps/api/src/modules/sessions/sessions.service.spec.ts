import * as fs from "node:fs";
import * as path from "node:path";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import {
  FALLBACK_SEED_TASK_DOC_LUA,
  LiveMatchPostCommitError,
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
    setNx: jest.Mock;
    compareAndDelete: jest.Mock;
    get: jest.Mock;
    hset: jest.Mock;
    hdel: jest.Mock;
    exists: jest.Mock;
    publish: jest.Mock;
    delete: jest.Mock;
    eval: jest.Mock;
    scanKeys: jest.Mock;
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
      setNx: jest.fn().mockResolvedValue(true),
      compareAndDelete: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockResolvedValue(null),
      hset: jest.fn().mockResolvedValue(undefined),
      hdel: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(false),
      publish: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      eval: jest.fn().mockResolvedValue(1),
      scanKeys: jest.fn().mockResolvedValue([]),
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
          inviteToken: result.inviteToken,
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

  describe("createLiveMatchSession", () => {
    it("создаёт сессию мгновенного матча, разогревает Redis-зеркало для обоих участников и инвалидирует кэш дашборда (TASK-BACK-42, TASK-BACK-45, TASK-BACK-46)", async () => {
      const partnerId = "33333333-3333-4333-c333-333333333333";
      prismaMock.interviewSession.create.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
      });

      const result = await service.createLiveMatchSession(ownerId, partnerId);

      expect(result.sessionId).toBe(sessionId);
      expect(result.inviteToken).toHaveLength(64);
      expect(prismaMock.interviewSession.create).toHaveBeenCalledWith({
        data: {
          userId: ownerId,
          status: "ACTIVE",
          inviteToken: result.inviteToken,
          startedAt: expect.any(Date),
          participants: {
            create: [
              { userId: ownerId, role: "CANDIDATE" },
              { userId: partnerId, role: "INTERVIEWER" },
            ],
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
        "CANDIDATE",
        7200,
      );
      expect(redisMock.hset).toHaveBeenCalledWith(
        `session:${sessionId}:members`,
        partnerId,
        "INTERVIEWER",
        7200,
      );
      expect(redisMock.set).toHaveBeenCalledWith(
        `session:${sessionId}:invite`,
        result.inviteToken,
        7200,
      );
      expect(redisMock.delete).toHaveBeenCalledWith(
        `cache:dashboard:upcoming:${ownerId}`,
      );
      expect(redisMock.delete).toHaveBeenCalledWith(
        `cache:dashboard:upcoming:${partnerId}`,
      );
    });

    it("выбрасывает LiveMatchPostCommitError с sessionId и inviteToken, если post-commit операция в Redis завершилась ошибкой", async () => {
      const partnerId = "33333333-3333-4333-c333-333333333333";
      prismaMock.interviewSession.create.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
      });
      redisMock.set.mockRejectedValueOnce(new Error("Redis connection lost"));

      await expect(
        service.createLiveMatchSession(ownerId, partnerId),
      ).rejects.toThrow(LiveMatchPostCommitError);

      try {
        await service.createLiveMatchSession(ownerId, partnerId);
      } catch (err) {
        expect(err).toBeInstanceOf(LiveMatchPostCommitError);
        if (err instanceof LiveMatchPostCommitError) {
          expect(err.sessionId).toBe(sessionId);
          expect(err.inviteToken).toHaveLength(64);
          expect(err.cause).toBeInstanceOf(Error);
        }
      }
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

    it("восстанавливает остывший токен из Postgres, если в Redis он отсутствует (холодное зеркало, TASK-BACK-37)", async () => {
      const dbInviteToken = service.generateInviteToken(sessionId);
      redisMock.get.mockResolvedValue(null);

      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        status: "ACTIVE",
        inviteToken: dbInviteToken,
        participants: [{ userId: ownerId, role: "INTERVIEWER" }],
      });
      prismaMock.interviewParticipant.upsert.mockResolvedValue({
        sessionId,
        userId: "candidate-1",
        role: "CANDIDATE",
      });

      const result = await service.joinSession(
        sessionId,
        "candidate-1",
        dbInviteToken,
      );

      expect(result.role).toBe("CANDIDATE");
      expect(result.inviteToken).toBe(dbInviteToken);
      expect(redisMock.set).toHaveBeenCalledWith(
        `session:${sessionId}:invite`,
        dbInviteToken,
        7200,
      );
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

    it("сохраняет legacy-токен из Redis в Postgres, если в Postgres он отсутствует (null)", async () => {
      const legacyToken = service.generateInviteToken(sessionId);
      redisMock.get.mockImplementation(async (key: string) => {
        if (key === `session:${sessionId}:invite`) return legacyToken;
        return null;
      });

      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        status: "ACTIVE",
        inviteToken: null,
        participants: [{ userId: ownerId, role: "INTERVIEWER" }],
      });
      prismaMock.interviewParticipant.upsert.mockResolvedValue({
        sessionId,
        userId: "candidate-legacy",
        role: "CANDIDATE",
      });

      const result = await service.joinSession(
        sessionId,
        "candidate-legacy",
        legacyToken,
      );

      expect(result.inviteToken).toBe(legacyToken);
      expect(prismaMock.interviewSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { inviteToken: legacyToken },
      });
    });

    it("при истёкшем ключе Redis и отсутствии токена в Postgres генерирует fallback и сохраняет в Postgres и Redis", async () => {
      redisMock.get.mockResolvedValue(null);

      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        status: "ACTIVE",
        inviteToken: null,
        participants: [{ userId: ownerId, role: "INTERVIEWER" }],
      });

      // Владелец подключается к legacy-сессии с остывшим ключом
      const result = await service.joinSession(sessionId, ownerId);

      expect(result.role).toBe("INTERVIEWER");
      expect(result.inviteToken).toHaveLength(64);
      expect(prismaMock.interviewSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { inviteToken: result.inviteToken },
      });
      expect(redisMock.set).toHaveBeenCalledWith(
        `session:${sessionId}:invite`,
        result.inviteToken,
        7200,
      );
    });

    it("отклоняет нового участника со старым токеном при истёкшем ключе Redis и inviteToken: null в Postgres", async () => {
      redisMock.get.mockResolvedValue(null);

      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        status: "ACTIVE",
        inviteToken: null,
        participants: [{ userId: ownerId, role: "INTERVIEWER" }],
      });

      await expect(
        service.joinSession(sessionId, "new-candidate", "some-old-token"),
      ).rejects.toThrow("User is not invited to this interview session");
    });
  });

  describe("addParticipant", () => {
    const participantId = "33333333-3333-4333-c333-333333333333";

    it("upsert-ит участника в Postgres и пишет в зеркало", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
        status: "ACTIVE",
        participants: [],
      });
      prismaMock.interviewParticipant.upsert.mockResolvedValue({});

      await service.addParticipant(
        sessionId,
        participantId,
        "CANDIDATE",
        ownerId,
      );

      expect(prismaMock.interviewParticipant.upsert).toHaveBeenCalledWith({
        where: { sessionId_userId: { sessionId, userId: participantId } },
        create: { sessionId, userId: participantId, role: "CANDIDATE" },
        update: { role: "CANDIDATE" },
      });
      expect(redisMock.hset).toHaveBeenCalledWith(
        `session:${sessionId}:members`,
        participantId,
        "CANDIDATE",
        7200,
      );
    });

    it("бросает NotFoundException при невалидном UUID (TASK-BACK-35)", async () => {
      await expect(
        service.addParticipant("invalid-uuid", participantId, "CANDIDATE"),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.addParticipant(sessionId, "invalid-uuid", "CANDIDATE"),
      ).rejects.toThrow(NotFoundException);
    });

    it("бросает ForbiddenException если статус сессии CLOSED (TASK-BACK-35)", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
        status: "CLOSED",
        participants: [],
      });

      await expect(
        service.addParticipant(sessionId, participantId, "CANDIDATE"),
      ).rejects.toThrow("Session is closed");
    });

    it("бросает ForbiddenException если достигнут лимит участников (TASK-BACK-35)", async () => {
      const fullParticipants = Array.from({ length: 10 }, (_, i) => ({
        userId: `00000000-0000-0000-0000-00000000000${i}`,
        role: "CANDIDATE",
      }));
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
        status: "ACTIVE",
        participants: fullParticipants,
      });

      await expect(
        service.addParticipant(sessionId, participantId, "CANDIDATE"),
      ).rejects.toThrow("Interview session is full");
    });

    it("бросает ForbiddenException если вызывающий не владелец (TASK-BACK-40)", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
        status: "ACTIVE",
        participants: [],
      });

      await expect(
        service.addParticipant(
          sessionId,
          participantId,
          "CANDIDATE",
          "not-owner",
        ),
      ).rejects.toThrow("Only the session owner can perform this action");
    });
  });

  describe("removeParticipant", () => {
    const participantId = "44444444-4444-4444-d444-444444444444";

    it("удаляет участника из Postgres, зеркала, публикует ревокацию и ротирует inviteToken (CWE-613)", async () => {
      const callOrder: string[] = [];
      prismaMock.$queryRaw.mockImplementation(async () => {
        callOrder.push("queryRaw-for-update");
        return [{ id: sessionId }];
      });
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
        status: "ACTIVE",
        participants: [{ userId: participantId, role: "CANDIDATE" }],
      });
      prismaMock.interviewSession.update.mockImplementation(async () => {
        callOrder.push("prisma-update-invite");
        return {};
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

      await service.removeParticipant(sessionId, participantId, ownerId);

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(prismaMock.interviewSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { inviteToken: expect.any(String) },
      });
      expect(prismaMock.interviewParticipant.delete).toHaveBeenCalledWith({
        where: { sessionId_userId: { sessionId, userId: participantId } },
      });
      expect(redisMock.hdel).toHaveBeenCalledWith(
        `session:${sessionId}:members`,
        participantId,
        7200,
      );
      expect(redisMock.publish).toHaveBeenCalledWith(
        "auth:revocations",
        expect.stringContaining(`"data":"${participantId}"`),
      );
      expect(redisMock.set).toHaveBeenCalledWith(
        `session:${sessionId}:invite`,
        expect.any(String),
        7200,
      );
    });

    it("бросает NotFoundException если передан невалидный UUID сессии", async () => {
      await expect(
        service.removeParticipant("invalid-uuid", participantId),
      ).rejects.toThrow(NotFoundException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("бросает NotFoundException если сессия не найдена при FOR UPDATE", async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);

      await expect(
        service.removeParticipant(sessionId, participantId),
      ).rejects.toThrow(NotFoundException);
    });

    it("бросает ForbiddenException при попытке удалить владельца сессии (TASK-BACK-36)", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
        status: "ACTIVE",
        participants: [{ userId: ownerId, role: "INTERVIEWER" }],
      });

      await expect(
        service.removeParticipant(sessionId, ownerId),
      ).rejects.toThrow("Cannot remove session owner");
    });

    it("бросает NotFoundException если участника нет в сессии (TASK-BACK-36)", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
        status: "ACTIVE",
        participants: [],
      });

      await expect(
        service.removeParticipant(sessionId, participantId),
      ).rejects.toThrow("Participant not found in session");
    });

    it("бросает ForbiddenException если статус сессии CLOSED (TASK-BACK-36)", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
        status: "CLOSED",
        participants: [{ userId: participantId, role: "CANDIDATE" }],
      });

      await expect(
        service.removeParticipant(sessionId, participantId),
      ).rejects.toThrow("Session is closed");
    });

    it("удалённый участник не может повторно присоединиться по старому inviteToken (CWE-613)", async () => {
      const kickedCandidateId = "55555555-5555-4555-8555-555555555555";
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

      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
        status: "ACTIVE",
        participants: [{ userId: kickedCandidateId, role: "CANDIDATE" }],
      });
      prismaMock.interviewParticipant.delete.mockResolvedValue({});
      prismaMock.interviewSession.update.mockResolvedValue({});

      await service.removeParticipant(sessionId, kickedCandidateId);

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
          kickedCandidateId,
          "1111111111111111111111111111111111111111111111111111111111111111",
        ),
      ).rejects.toThrow("User is not invited to this interview session");
    });
  });

  describe("rotateInviteToken", () => {
    it("ротирует inviteToken в Postgres и Redis и возвращает новый токен", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
        status: "ACTIVE",
      });
      prismaMock.interviewSession.update.mockResolvedValue({});

      const result = await service.rotateInviteToken(sessionId, ownerId);

      expect(result.inviteToken).toHaveLength(64);
      expect(prismaMock.interviewSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { inviteToken: result.inviteToken },
      });
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

    it("бросает ForbiddenException если вызывающий не владелец (TASK-BACK-40)", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
        status: "ACTIVE",
      });

      await expect(
        service.rotateInviteToken(sessionId, "not-owner"),
      ).rejects.toThrow("Only the session owner can perform this action");
    });

    it("бросает ForbiddenException если сессия закрыта", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
        status: "CLOSED",
      });

      await expect(service.rotateInviteToken(sessionId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("closeSession", () => {
    it("закрывает сессию, публикует room-scoped ревокации и удаляет inviteToken и members (TASK-BACK-38)", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
        status: "ACTIVE",
        participants: [
          { userId: "u-1", role: "INTERVIEWER" },
          { userId: "u-2", role: "CANDIDATE" },
        ],
      });
      prismaMock.interviewSession.update.mockResolvedValue({});

      await service.closeSession(sessionId, ownerId);

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
      expect(redisMock.delete).toHaveBeenCalledWith(
        `session:${sessionId}:members`,
      );
      expect(redisMock.delete).toHaveBeenCalledWith(
        "cache:dashboard:upcoming:u-1",
      );
      expect(redisMock.delete).toHaveBeenCalledWith(
        "cache:dashboard:upcoming:u-2",
      );
      expect(redisMock.delete).toHaveBeenCalledWith(
        "cache:dashboard:stats:u-1",
      );
      expect(redisMock.delete).toHaveBeenCalledWith(
        "cache:dashboard:stats:u-2",
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

    it("не перезаписывает endedAt если сессия уже закрыта (TASK-BACK-39)", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
        status: "CLOSED",
        participants: [],
      });

      await service.closeSession(sessionId, ownerId);

      expect(prismaMock.interviewSession.update).not.toHaveBeenCalled();
      expect(redisMock.publish).not.toHaveBeenCalled();
    });

    it("бросает ForbiddenException если вызывающий не владелец (TASK-BACK-40)", async () => {
      prismaMock.interviewSession.findUnique.mockResolvedValue({
        id: sessionId,
        userId: ownerId,
        status: "ACTIVE",
        participants: [],
      });

      await expect(
        service.closeSession(sessionId, "not-owner"),
      ).rejects.toThrow("Only the session owner can perform this action");
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
    it("восстанавливает зеркало ACTIVE-сессий из Postgres через атомарный Lua-скрипт", async () => {
      prismaMock.interviewSession.findMany.mockResolvedValue([
        {
          id: sessionId,
          userId: ownerId,
          status: "ACTIVE",
          participants: [{ userId: ownerId, role: "INTERVIEWER" }],
        },
      ]);

      await service.reconcileMirrors();

      expect(redisMock.setNx).toHaveBeenCalledWith(
        "lock:cron:session-mirror-reconcile",
        expect.any(String),
        300,
      );
      expect(redisMock.eval).toHaveBeenCalledWith(
        expect.any(String),
        3,
        `session:${sessionId}:active`,
        `session:${sessionId}:members`,
        `session:${sessionId}:invite`,
        "true",
        "closed",
        7200,
        expect.any(String),
        ownerId,
        "INTERVIEWER",
      );
      expect(redisMock.compareAndDelete).toHaveBeenCalledWith(
        "lock:cron:session-mirror-reconcile",
        expect.any(String),
      );
    });

    it("пропускает выполнение, если распределенный замок уже занят другой репликой", async () => {
      redisMock.setNx.mockResolvedValue(false);

      await service.reconcileMirrors();

      expect(prismaMock.interviewSession.findMany).not.toHaveBeenCalled();
      expect(redisMock.eval).not.toHaveBeenCalled();
      expect(redisMock.compareAndDelete).not.toHaveBeenCalled();
    });

    it("не падает при ошибке Postgres и освобождает распределенный замок", async () => {
      prismaMock.interviewSession.findMany.mockRejectedValue(
        new Error("db down"),
      );

      await expect(service.reconcileMirrors()).resolves.toBeUndefined();
      expect(redisMock.compareAndDelete).toHaveBeenCalledWith(
        "lock:cron:session-mirror-reconcile",
        expect.any(String),
      );
    });

    it("продолжает обработку других сессий при ошибке на одной сессии", async () => {
      prismaMock.interviewSession.findMany.mockResolvedValue([
        {
          id: "session-fail",
          userId: "u-1",
          status: "ACTIVE",
          participants: [],
        },
        {
          id: "session-ok",
          userId: "u-2",
          status: "ACTIVE",
          participants: [{ userId: "u-2", role: "CANDIDATE" }],
        },
      ]);

      redisMock.eval
        .mockRejectedValueOnce(new Error("redis fail"))
        .mockResolvedValueOnce(1);

      await expect(service.reconcileMirrors()).resolves.toBeUndefined();

      expect(redisMock.eval).toHaveBeenCalledTimes(2);
      expect(redisMock.compareAndDelete).toHaveBeenCalledWith(
        "lock:cron:session-mirror-reconcile",
        expect.any(String),
      );
    });

    it("сохраняет фактически выбранный существующий токен из Redis в Postgres при inviteToken: null", async () => {
      const existingRedisToken = "a".repeat(64);
      prismaMock.interviewSession.findMany.mockResolvedValue([
        {
          id: sessionId,
          userId: ownerId,
          status: "ACTIVE",
          inviteToken: null,
          participants: [{ userId: ownerId, role: "INTERVIEWER" }],
        },
      ]);

      redisMock.eval.mockResolvedValue([1, existingRedisToken]);

      await service.reconcileMirrors();

      expect(prismaMock.interviewSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { inviteToken: existingRedisToken },
      });
    });

    it("сохраняет fallback токен в Postgres при inviteToken: null и отсутствии ключа в Redis", async () => {
      const fallbackToken = "b".repeat(64);
      prismaMock.interviewSession.findMany.mockResolvedValue([
        {
          id: sessionId,
          userId: ownerId,
          status: "ACTIVE",
          inviteToken: null,
          participants: [{ userId: ownerId, role: "INTERVIEWER" }],
        },
      ]);

      redisMock.eval.mockResolvedValue([1, fallbackToken]);

      await service.reconcileMirrors();

      expect(prismaMock.interviewSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { inviteToken: fallbackToken },
      });
    });
  });

  describe("backfillActiveInviteTokens", () => {
    it("читает токен из sessionInviteKey в Redis и записывает его в Postgres для ACTIVE-сессий", async () => {
      const legacyToken1 = "1".repeat(64);
      const legacyToken2 = "2".repeat(64);

      prismaMock.interviewSession.findMany.mockResolvedValue([
        { id: "session-1", inviteToken: null },
        { id: "session-2", inviteToken: null },
      ]);

      redisMock.get.mockImplementation(async (key: string) => {
        if (key === "session:session-1:invite") return legacyToken1;
        if (key === "session:session-2:invite") return legacyToken2;
        return null;
      });

      const stats = await service.backfillActiveInviteTokens();

      expect(stats).toEqual({ total: 2, updated: 2, expired: 0 });
      expect(prismaMock.interviewSession.update).toHaveBeenCalledWith({
        where: { id: "session-1" },
        data: { inviteToken: legacyToken1 },
      });
      expect(prismaMock.interviewSession.update).toHaveBeenCalledWith({
        where: { id: "session-2" },
        data: { inviteToken: legacyToken2 },
      });
    });

    it("учитывает истёкшие ключи Redis и не обновляет для них Postgres", async () => {
      const legacyToken = "3".repeat(64);

      prismaMock.interviewSession.findMany.mockResolvedValue([
        { id: "session-live", inviteToken: null },
        { id: "session-expired", inviteToken: null },
      ]);

      redisMock.get.mockImplementation(async (key: string) => {
        if (key === "session:session-live:invite") return legacyToken;
        return null; // session-expired
      });

      const stats = await service.backfillActiveInviteTokens();

      expect(stats).toEqual({ total: 2, updated: 1, expired: 1 });
      expect(prismaMock.interviewSession.update).toHaveBeenCalledWith({
        where: { id: "session-live" },
        data: { inviteToken: legacyToken },
      });
      expect(prismaMock.interviewSession.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "session-expired" },
        }),
      );
    });

    it("корректно обрабатывает пагинацию батчами", async () => {
      const batch1 = Array.from({ length: 50 }, (_, i) => ({
        id: `s-${i}`,
        inviteToken: null,
      }));
      const batch2 = [{ id: "s-50", inviteToken: null }];

      prismaMock.interviewSession.findMany
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2);

      redisMock.get.mockResolvedValue(`${"tok".repeat(21)}1`);

      const stats = await service.backfillActiveInviteTokens();

      expect(stats.total).toBe(51);
      expect(stats.updated).toBe(51);
      expect(prismaMock.interviewSession.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe("SEED_TASK_DOC_LUA contract with apps/realtime", () => {
    const realtimeScriptPath = path.resolve(
      __dirname,
      REALTIME_SEED_TASK_DOC_LUA_RELATIVE_PATH,
    );
    const contractTest = fs.existsSync(realtimeScriptPath) ? it : it.skip;

    contractTest(
      "соответствует seed_task_doc.lua из apps/realtime (Docker/CI safe, TASK-BACK-41)",
      () => {
        const realtimeContent = fs.readFileSync(realtimeScriptPath, "utf-8");

        const normalize = (script: string) =>
          script
            .replace(/\r\n/g, "\n")
            .replace(/--[^\n]*/g, "") // Удаляем однострочные комментарии Lua
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .join("\n");

        // Резервная копия должна совпадать с источником истины
        expect(normalize(FALLBACK_SEED_TASK_DOC_LUA)).toBe(
          normalize(realtimeContent),
        );
        expect(normalize(SEED_TASK_DOC_LUA)).toBe(normalize(realtimeContent));
      },
    );
  });
});
