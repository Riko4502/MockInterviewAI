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

function createStoredSession(
  refreshTokenHash: string,
  generation = 1,
): AuthSession {
  const now = "2026-08-01T00:00:00.000Z";
  return {
    userId: USER_ID,
    refreshTokenHash,
    tokenFamilyId: FAMILY_ID,
    createdAt: now,
    lastUsedAt: now,
    generation,
  };
}

describe("AuthSessionService", () => {
  let service: AuthSessionService;
  let redisSet: jest.Mock;
  let redisGet: jest.Mock;
  let redisMget: jest.Mock;
  let redisDelete: jest.Mock;
  let redisScanKeys: jest.Mock;
  let redisEval: jest.Mock;

  beforeEach(() => {
    redisSet = jest.fn().mockResolvedValue("OK");
    redisGet = jest.fn().mockResolvedValue(null);
    redisMget = jest.fn().mockImplementation(async (keys: string[]) => {
      return Promise.all(keys.map((k) => redisGet(k)));
    });
    redisDelete = jest.fn().mockResolvedValue(1);
    redisScanKeys = jest.fn().mockResolvedValue([]);
    redisEval = jest
      .fn()
      .mockImplementation(
        async (script: string, keys: string[], args?: unknown[]) => {
          if (script.includes("session.refreshTokenHash == new_hash")) {
            const sessionKey = keys[0];
            const newHash = args?.[0] as string;
            const nowIso = args?.[1] as string;
            const raw = await redisGet(sessionKey);
            if (!raw) return null;
            const session = JSON.parse(raw) as AuthSession;
            if (session.refreshTokenHash === newHash) {
              await redisDelete(sessionKey);
              return "REPLAY";
            }
            session.refreshTokenHash = newHash;
            session.lastUsedAt = nowIso;
            await redisSet(sessionKey, JSON.stringify(session));
            return JSON.stringify(session);
          }
          return 1;
        },
      );

    service = new AuthSessionService(
      {
        set: redisSet,
        get: redisGet,
        mget: redisMget,
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
      await service.createSession(SESSION_ID, USER_ID, "hash", FAMILY_ID, 1);

      expect(redisEval).toHaveBeenCalledTimes(1);
      expect(redisEval.mock.calls[0][1][0]).toBe(
        `auth:user:${USER_ID}:min_generation`,
      );
      expect(redisEval.mock.calls[0][1][1]).toBe(`auth:session:${SESSION_ID}`);
      expect(redisEval.mock.calls[0][1][2]).toBe(
        `auth:user:${USER_ID}:sessions`,
      );
      expect(redisEval.mock.calls[0][2][0]).toBe(1);
      expect(redisEval.mock.calls[0][2][3]).toBe(SESSION_ID);
    });

    it("записывает JSON со всеми полями payload (§16 SPEC.md)", async () => {
      const session = await service.createSession(
        SESSION_ID,
        USER_ID,
        "hash",
        FAMILY_ID,
        1,
      );

      const [, , [, raw]] = redisEval.mock.calls[0];
      const stored = JSON.parse(raw) as AuthSession;

      expect(stored.userId).toBe(USER_ID);
      expect(stored.refreshTokenHash).toBe("hash");
      expect(stored.tokenFamilyId).toBe(FAMILY_ID);
      expect(stored.createdAt).toBe(stored.lastUsedAt);
      expect(stored.generation).toBe(1);
      expect(stored.createdAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(session).toEqual(stored);
    });

    it("устанавливает TTL по умолчанию 7 дней", async () => {
      await service.createSession(SESSION_ID, USER_ID, "hash", FAMILY_ID, 1);

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

      await service.createSession(SESSION_ID, USER_ID, "hash", FAMILY_ID, 1);

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
    it("мержит поля и атомарно обновляет ключ сессии и ZSET через UPDATE_SESSION_LUA (§CWE-613)", async () => {
      redisGet.mockResolvedValue(JSON.stringify(createStoredSession("old")));

      const updated = await service.updateSession(SESSION_ID, {
        refreshTokenHash: "new",
      });

      expect(updated?.refreshTokenHash).toBe("new");
      expect(updated?.userId).toBe(USER_ID);
      expect(updated?.tokenFamilyId).toBe(FAMILY_ID);

      expect(redisEval).toHaveBeenCalledTimes(1);
      const [_script, keys, args] = redisEval.mock.calls[0];
      expect(keys[0]).toBe(`auth:session:${SESSION_ID}`);
      expect(keys[1]).toBe(`auth:user:${USER_ID}:sessions`);
      expect(args[1]).toBe(604800);
      expect(args[2]).toBe(SESSION_ID);
      expect(typeof args[3]).toBe("number");
      expect(JSON.parse(args[0])).toMatchObject({
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
      expect(redisEval).not.toHaveBeenCalled();
    });

    it("пробрасывает ошибку при сбое в Redis и не подавляет исключение (§CWE-613)", async () => {
      redisGet.mockResolvedValue(JSON.stringify(createStoredSession("old")));
      redisEval.mockRejectedValue(new Error("Redis connection failure"));

      await expect(
        service.updateSession(SESSION_ID, { refreshTokenHash: "new" }),
      ).rejects.toThrow("Redis connection failure");
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

      expect(redisEval).toHaveBeenCalledWith(
        expect.stringContaining("zrem"),
        [`auth:user:${USER_ID}:sessions`],
        [sessionId],
      );
      expect(redisDelete).not.toHaveBeenCalledWith(`auth:session:${sessionId}`);
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

    it("не изменяет min_generation fence, если maxGeneration не передано (undefined)", async () => {
      redisEval.mockResolvedValue([]);

      await service.revokeAllUserSessions(USER_ID);

      expect(redisEval).not.toHaveBeenCalledWith(
        expect.any(String),
        [`auth:user:${USER_ID}:min_generation`],
        expect.anything(),
      );
    });

    it("отзывает legacy-сессию без поля generation при передаче maxGeneration (§CWE-613)", async () => {
      const legacySessionId = randomUUID();
      const newGenSessionId = randomUUID();

      const legacySession = {
        ...createStoredSession("legacy-hash"),
        userId: USER_ID,
      };
      delete (legacySession as { generation?: number }).generation;

      const newGenSession: AuthSession = {
        ...createStoredSession("new-gen-hash"),
        userId: USER_ID,
        generation: 3,
      };

      redisEval.mockImplementation(async (_script: string, keys: string[]) => {
        if (keys[0] === `auth:user:${USER_ID}:sessions`) {
          return [legacySessionId, newGenSessionId];
        }
        return 1;
      });

      redisGet.mockImplementation(async (key: string) => {
        if (key === `auth:session:${legacySessionId}`) {
          return JSON.stringify(legacySession);
        }
        if (key === `auth:session:${newGenSessionId}`) {
          return JSON.stringify(newGenSession);
        }
        return null;
      });

      await service.revokeAllUserSessions(USER_ID, undefined, 2);

      expect(redisDelete).toHaveBeenCalledWith(
        `auth:session:${legacySessionId}`,
      );
      expect(redisDelete).not.toHaveBeenCalledWith(
        `auth:session:${newGenSessionId}`,
      );
    });

    it("одновременно применяет фильтры maxGeneration и maxCreatedAt (§SessionRevocationCron)", async () => {
      const legacyOldSessionId = randomUUID();
      const legacyNewSessionId = randomUUID();
      const gen1OldSessionId = randomUUID();
      const gen2OldSessionId = randomUUID();

      const cutoff = new Date("2026-08-01T12:00:00.000Z");

      const legacyOldSession = {
        ...createStoredSession("h-leg-old"),
        userId: USER_ID,
        createdAt: "2026-08-01T10:00:00.000Z",
      };
      delete (legacyOldSession as { generation?: number }).generation;

      const legacyNewSession = {
        ...createStoredSession("h-leg-new"),
        userId: USER_ID,
        createdAt: "2026-08-01T14:00:00.000Z",
      };
      delete (legacyNewSession as { generation?: number }).generation;

      const gen1OldSession: AuthSession = {
        ...createStoredSession("h-gen1-old"),
        userId: USER_ID,
        generation: 1,
        createdAt: "2026-08-01T10:00:00.000Z",
      };

      const gen2OldSession: AuthSession = {
        ...createStoredSession("h-gen2-old"),
        userId: USER_ID,
        generation: 2,
        createdAt: "2026-08-01T10:00:00.000Z",
      };

      redisEval.mockImplementation(async (_script: string, keys: string[]) => {
        if (keys[0] === `auth:user:${USER_ID}:sessions`) {
          return [
            legacyOldSessionId,
            legacyNewSessionId,
            gen1OldSessionId,
            gen2OldSessionId,
          ];
        }
        return 1;
      });

      redisGet.mockImplementation(async (key: string) => {
        if (key === `auth:session:${legacyOldSessionId}`)
          return JSON.stringify(legacyOldSession);
        if (key === `auth:session:${legacyNewSessionId}`)
          return JSON.stringify(legacyNewSession);
        if (key === `auth:session:${gen1OldSessionId}`)
          return JSON.stringify(gen1OldSession);
        if (key === `auth:session:${gen2OldSessionId}`)
          return JSON.stringify(gen2OldSession);
        return null;
      });

      await service.revokeAllUserSessions(USER_ID, cutoff, 1);

      expect(redisDelete).toHaveBeenCalledWith(
        `auth:session:${legacyOldSessionId}`,
      );
      expect(redisDelete).toHaveBeenCalledWith(
        `auth:session:${gen1OldSessionId}`,
      );
      expect(redisDelete).not.toHaveBeenCalledWith(
        `auth:session:${legacyNewSessionId}`,
      );
      expect(redisDelete).not.toHaveBeenCalledWith(
        `auth:session:${gen2OldSessionId}`,
      );
    });

    it("пробрасывает ошибку при сбое удаления сессии в Redis и сохраняет ZSET для повтора (§CWE-613)", async () => {
      const sessionId = randomUUID();
      const session: AuthSession = {
        ...createStoredSession("h1"),
        userId: USER_ID,
      };

      redisEval.mockImplementation(async (_script: string, keys: string[]) => {
        if (keys[0] === `auth:user:${USER_ID}:sessions`) {
          return [sessionId];
        }
        return 1;
      });

      redisGet.mockResolvedValue(JSON.stringify(session));
      redisDelete.mockRejectedValue(new Error("Redis connection lost"));

      await expect(service.revokeAllUserSessions(USER_ID)).rejects.toThrow(
        "Failed to revoke sessions",
      );
      expect(redisDelete).not.toHaveBeenCalledWith(
        `auth:user:${USER_ID}:sessions`,
      );
    });
  });
});
