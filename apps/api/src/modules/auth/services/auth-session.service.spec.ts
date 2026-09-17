import { randomUUID } from "node:crypto";
import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { RedisService } from "../../../redis/redis.service";
import { type AuthSession, AuthSessionService } from "./auth-session.service";

const SESSION_ID = randomUUID();
const USER_ID = randomUUID();
const FAMILY_ID = randomUUID();

type LoggerAccessor = {
  logger: {
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
  };
};

function createConfigService(refreshExpiresIn?: string): ConfigService {
  return {
    get: jest.fn().mockImplementation(() => refreshExpiresIn),
  } as unknown as ConfigService;
}

function createStoredSession(refreshTokenHash: string): AuthSession {
  const now = "2026-08-01T00:00:00.000Z";
  return {
    userId: USER_ID,
    refreshTokenHash,
    tokenFamilyId: FAMILY_ID,
    createdAt: now,
    lastUsedAt: now,
  };
}

describe("AuthSessionService", () => {
  let service: AuthSessionService;
  let redisSet: jest.Mock;
  let redisGet: jest.Mock;
  let redisDelete: jest.Mock;
  let redisScanKeys: jest.Mock;
  let redisEval: jest.Mock;

  beforeEach(() => {
    redisSet = jest.fn().mockResolvedValue("OK");
    redisGet = jest.fn().mockResolvedValue(null);
    redisDelete = jest.fn().mockResolvedValue(1);
    redisScanKeys = jest.fn().mockResolvedValue([]);
    redisEval = jest.fn().mockResolvedValue(1);

    service = new AuthSessionService(
      {
        set: redisSet,
        get: redisGet,
        delete: redisDelete,
        scanKeys: redisScanKeys,
        eval: redisEval,
      } as unknown as RedisService,
      createConfigService(),
    );

    jest
      .spyOn((service as unknown as LoggerAccessor).logger, "debug")
      .mockImplementation(() => undefined);
    jest
      .spyOn((service as unknown as LoggerAccessor).logger, "warn")
      .mockImplementation(() => undefined);
  });

  describe("createSession", () => {
    it("сохраняет session под ключом auth:session:{sessionId} и индексирует в ZSET (§CWE-362, Task 7)", async () => {
      await service.createSession(SESSION_ID, USER_ID, "hash", FAMILY_ID);

      expect(redisEval).toHaveBeenCalledTimes(1);
      expect(redisEval.mock.calls[0][1][0]).toBe(
        `auth:user:${USER_ID}:min_generation`,
      );
      expect(redisEval.mock.calls[0][1][1]).toBe(`auth:session:${SESSION_ID}`);
      expect(redisEval.mock.calls[0][1][2]).toBe(
        `auth:user:${USER_ID}:sessions`,
      );
      expect(redisEval.mock.calls[0][2][3]).toBe(SESSION_ID);
    });

    it("записывает JSON со всеми полями payload (§16 SPEC.md)", async () => {
      const session = await service.createSession(
        SESSION_ID,
        USER_ID,
        "hash",
        FAMILY_ID,
      );

      const [, , [, raw]] = redisEval.mock.calls[0];
      const stored = JSON.parse(raw) as AuthSession;

      expect(stored.userId).toBe(USER_ID);
      expect(stored.refreshTokenHash).toBe("hash");
      expect(stored.tokenFamilyId).toBe(FAMILY_ID);
      expect(stored.createdAt).toBe(stored.lastUsedAt);
      expect(stored.createdAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(session).toEqual(stored);
    });

    it("устанавливает TTL по умолчанию 7 дней", async () => {
      await service.createSession(SESSION_ID, USER_ID, "hash", FAMILY_ID);

      expect(redisEval.mock.calls[0][2][2]).toBe(604800);
    });

    it("вычисляет TTL из конфига jwt.refreshExpiresIn", async () => {
      service = new AuthSessionService(
        {
          set: redisSet,
          get: redisGet,
          delete: redisDelete,
          eval: redisEval,
        } as unknown as RedisService,
        createConfigService("1h"),
      );

      await service.createSession(SESSION_ID, USER_ID, "hash", FAMILY_ID);

      expect(redisEval.mock.calls[0][2][2]).toBe(3600);
    });

    it("выбрасывает UnauthorizedException если поколение сессии устарело (fence min_generation)", async () => {
      redisEval.mockResolvedValue(-1);

      await expect(
        service.createSession(SESSION_ID, USER_ID, "hash", FAMILY_ID, 2),
      ).rejects.toThrow(UnauthorizedException);

      expect(redisEval).toHaveBeenCalledTimes(1);
      expect(redisEval.mock.calls[0][2][0]).toBe(2);
    });
  });

  describe("getSession", () => {
    it("возвращает распарсенную session", async () => {
      redisGet.mockResolvedValue(JSON.stringify(createStoredSession("hash")));

      const session = await service.getSession(SESSION_ID);

      expect(redisGet).toHaveBeenCalledWith(`auth:session:${SESSION_ID}`);
      expect(session?.userId).toBe(USER_ID);
      expect(session?.refreshTokenHash).toBe("hash");
      expect(session?.tokenFamilyId).toBe(FAMILY_ID);
    });

    it("возвращает null если session не существует", async () => {
      redisGet.mockResolvedValue(null);

      expect(await service.getSession(SESSION_ID)).toBeNull();
    });
  });

  describe("updateSession", () => {
    it("мержит поля и перезаписывает JSON с TTL", async () => {
      redisGet.mockResolvedValue(JSON.stringify(createStoredSession("old")));

      const updated = await service.updateSession(SESSION_ID, {
        refreshTokenHash: "new",
      });

      expect(updated?.refreshTokenHash).toBe("new");
      expect(updated?.userId).toBe(USER_ID);
      expect(updated?.tokenFamilyId).toBe(FAMILY_ID);

      const [key, raw, ttl] = redisSet.mock.calls[0];
      expect(key).toBe(`auth:session:${SESSION_ID}`);
      expect(ttl).toBe(604800);
      expect(JSON.parse(raw)).toMatchObject({
        userId: USER_ID,
        refreshTokenHash: "new",
      });
    });

    it("возвращает null если session не найдена", async () => {
      redisGet.mockResolvedValue(null);

      const updated = await service.updateSession(SESSION_ID, {
        refreshTokenHash: "new",
      });

      expect(updated).toBeNull();
      expect(redisSet).not.toHaveBeenCalled();
    });
  });

  describe("deleteSession / revokeSession", () => {
    it("удаляет ключ auth:session:{sessionId} и запись из ZSET", async () => {
      redisGet.mockResolvedValue(JSON.stringify(createStoredSession("hash")));

      await service.deleteSession(SESSION_ID);

      expect(redisDelete).toHaveBeenCalledWith(`auth:session:${SESSION_ID}`);
      expect(redisEval).toHaveBeenCalledWith(
        expect.stringContaining("zrem"),
        [`auth:user:${USER_ID}:sessions`],
        [SESSION_ID],
      );
    });

    it("revokeSession делегирует deleteSession", async () => {
      redisGet.mockResolvedValue(JSON.stringify(createStoredSession("hash")));

      await service.revokeSession(SESSION_ID);

      expect(redisDelete).toHaveBeenCalledWith(`auth:session:${SESSION_ID}`);
    });
  });

  describe("rotateSession", () => {
    it("replay detected (хеш совпадает) → revoke + null", async () => {
      redisGet.mockResolvedValue(
        JSON.stringify(createStoredSession("same-hash")),
      );

      const result = await service.rotateSession(SESSION_ID, "same-hash");

      expect(result).toBeNull();
      expect(redisDelete).toHaveBeenCalledWith(`auth:session:${SESSION_ID}`);
    });

    it("успешная ротация → обновляет refreshTokenHash и lastUsedAt", async () => {
      redisGet.mockResolvedValue(
        JSON.stringify(createStoredSession("old-hash")),
      );

      const result = await service.rotateSession(SESSION_ID, "new-hash");

      expect(result?.refreshTokenHash).toBe("new-hash");
      expect(result?.lastUsedAt).not.toBe("2026-08-01T00:00:00.000Z");
      expect(redisSet).toHaveBeenCalledTimes(1);
      const persisted = JSON.parse(redisSet.mock.calls[0][1]) as AuthSession;
      expect(persisted.lastUsedAt).toBe(result?.lastUsedAt);
    });

    it("сессия не найдена → null", async () => {
      redisGet.mockResolvedValue(null);

      const result = await service.rotateSession(SESSION_ID, "any-hash");

      expect(result).toBeNull();
    });
  });

  describe("revokeAllUserSessions", () => {
    it("удаляет только сессии переданного userId через ZSET выборку", async () => {
      const sessionId1 = randomUUID();
      const sessionId2 = randomUUID();

      const session1: AuthSession = {
        ...createStoredSession("h1"),
        userId: USER_ID,
      };
      const session2: AuthSession = {
        ...createStoredSession("h2"),
        userId: USER_ID,
      };

      redisEval.mockImplementation(async (_script: string, keys: string[]) => {
        if (keys[0] === `auth:user:${USER_ID}:sessions`) {
          return [sessionId1, sessionId2];
        }
        return 1;
      });

      redisGet.mockImplementation(async (key: string) => {
        if (key === `auth:session:${sessionId1}`)
          return JSON.stringify(session1);
        if (key === `auth:session:${sessionId2}`)
          return JSON.stringify(session2);
        return null;
      });

      await service.revokeAllUserSessions(USER_ID);

      expect(redisDelete).toHaveBeenCalledWith(`auth:session:${sessionId1}`);
      expect(redisDelete).toHaveBeenCalledWith(`auth:session:${sessionId2}`);
      expect(redisDelete).toHaveBeenCalledWith(`auth:user:${USER_ID}:sessions`);
    });

    it("нет сессий в ZSET → no-op", async () => {
      redisEval.mockResolvedValue([]);

      await service.revokeAllUserSessions(USER_ID);

      expect(redisGet).not.toHaveBeenCalled();
      expect(redisDelete).not.toHaveBeenCalled();
    });

    it("сессия с истекшим ключом удаляется из ZSET", async () => {
      const sessionId = randomUUID();
      redisEval.mockImplementation(async (_script: string, keys: string[]) => {
        if (keys[0] === `auth:user:${USER_ID}:sessions`) {
          return [sessionId];
        }
        return 1;
      });
      redisGet.mockResolvedValue(null);

      await service.revokeAllUserSessions(USER_ID);

      expect(redisDelete).toHaveBeenCalledWith(`auth:user:${USER_ID}:sessions`);
    });

    it("удаляет только сессии, созданные не позднее maxCreatedAt", async () => {
      const oldSessionId = randomUUID();
      const newSessionId = randomUUID();
      const cutoff = new Date("2026-08-01T12:00:00.000Z");

      const oldSession: AuthSession = {
        ...createStoredSession("h-old"),
        createdAt: "2026-08-01T10:00:00.000Z",
      };
      const newSession: AuthSession = {
        ...createStoredSession("h-new"),
        createdAt: "2026-08-01T14:00:00.000Z",
      };

      redisEval.mockImplementation(async (_script: string, keys: string[]) => {
        if (keys[0] === `auth:user:${USER_ID}:sessions`) {
          return [oldSessionId, newSessionId];
        }
        return 1;
      });

      redisGet.mockImplementation(async (key: string) => {
        if (key === `auth:session:${oldSessionId}`)
          return JSON.stringify(oldSession);
        if (key === `auth:session:${newSessionId}`)
          return JSON.stringify(newSession);
        return null;
      });

      await service.revokeAllUserSessions(USER_ID, cutoff);

      expect(redisDelete).toHaveBeenCalledWith(`auth:session:${oldSessionId}`);
      expect(redisDelete).not.toHaveBeenCalledWith(
        `auth:session:${newSessionId}`,
      );
    });

    it("удаляет сессии с generation <= maxGeneration", async () => {
      const gen1SessionId = randomUUID();
      const gen2SessionId = randomUUID();

      const gen1Session: AuthSession = {
        ...createStoredSession("h-gen1"),
        generation: 1,
      };
      const gen2Session: AuthSession = {
        ...createStoredSession("h-gen2"),
        generation: 2,
      };

      redisEval.mockImplementation(async (_script: string, keys: string[]) => {
        if (keys[0] === `auth:user:${USER_ID}:sessions`) {
          return [gen1SessionId, gen2SessionId];
        }
        return 1;
      });

      redisGet.mockImplementation(async (key: string) => {
        if (key === `auth:session:${gen1SessionId}`)
          return JSON.stringify(gen1Session);
        if (key === `auth:session:${gen2SessionId}`)
          return JSON.stringify(gen2Session);
        return null;
      });

      await service.revokeAllUserSessions(USER_ID, undefined, 1);

      expect(redisEval).toHaveBeenCalledWith(
        expect.any(String),
        [`auth:user:${USER_ID}:min_generation`],
        [2, 604800],
      );
      expect(redisDelete).toHaveBeenCalledWith(`auth:session:${gen1SessionId}`);
      expect(redisDelete).not.toHaveBeenCalledWith(
        `auth:session:${gen2SessionId}`,
      );
    });
  });
});
