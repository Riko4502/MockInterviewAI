import { randomUUID } from "node:crypto";
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

  beforeEach(() => {
    redisSet = jest.fn().mockResolvedValue("OK");
    redisGet = jest.fn().mockResolvedValue(null);
    redisDelete = jest.fn().mockResolvedValue(1);
    redisScanKeys = jest.fn().mockResolvedValue([]);

    service = new AuthSessionService(
      {
        set: redisSet,
        get: redisGet,
        delete: redisDelete,
        scanKeys: redisScanKeys,
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
    it("сохраняет session под ключом auth:session:{sessionId}", async () => {
      await service.createSession(SESSION_ID, USER_ID, "hash", FAMILY_ID);

      expect(redisSet).toHaveBeenCalledTimes(1);
      expect(redisSet.mock.calls[0][0]).toBe(`auth:session:${SESSION_ID}`);
    });

    it("записывает JSON со всеми полями payload (§16 SPEC.md)", async () => {
      const session = await service.createSession(
        SESSION_ID,
        USER_ID,
        "hash",
        FAMILY_ID,
      );

      const [, raw] = redisSet.mock.calls[0];
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

      expect(redisSet.mock.calls[0][2]).toBe(604800);
    });

    it("вычисляет TTL из конфига jwt.refreshExpiresIn", async () => {
      service = new AuthSessionService(
        {
          set: redisSet,
          get: redisGet,
          delete: redisDelete,
        } as unknown as RedisService,
        createConfigService("1h"),
      );

      await service.createSession(SESSION_ID, USER_ID, "hash", FAMILY_ID);

      expect(redisSet.mock.calls[0][2]).toBe(3600);
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

      const result = await service.updateSession(SESSION_ID, {
        lastUsedAt: new Date().toISOString(),
      });

      expect(result).toBeNull();
      expect(redisSet).not.toHaveBeenCalled();
    });
  });

  describe("deleteSession", () => {
    it("удаляет ключ session", async () => {
      await service.deleteSession(SESSION_ID);

      expect(redisDelete).toHaveBeenCalledWith(`auth:session:${SESSION_ID}`);
    });
  });

  describe("rotateSession", () => {
    it("при новом hash обновляет refreshTokenHash и lastUsedAt", async () => {
      const stored = createStoredSession("old-hash");
      redisGet.mockResolvedValue(JSON.stringify(stored));

      const rotated = await service.rotateSession(SESSION_ID, "new-hash");

      expect(rotated?.refreshTokenHash).toBe("new-hash");
      expect(rotated?.tokenFamilyId).toBe(FAMILY_ID);
      expect(rotated?.lastUsedAt).not.toBe(stored.createdAt);

      const [, raw, ttl] = redisSet.mock.calls[0];
      expect(ttl).toBe(604800);
      expect(JSON.parse(raw)).toMatchObject({
        refreshTokenHash: "new-hash",
        userId: USER_ID,
      });
    });

    it("replay detection: тот же hash отзывает session и возвращает null", async () => {
      redisGet.mockResolvedValue(
        JSON.stringify(createStoredSession("same-hash")),
      );

      const result = await service.rotateSession(SESSION_ID, "same-hash");

      expect(result).toBeNull();
      expect(redisDelete).toHaveBeenCalledWith(`auth:session:${SESSION_ID}`);
      expect(redisSet).not.toHaveBeenCalled();
    });

    it("несуществующая session → null без удаления", async () => {
      redisGet.mockResolvedValue(null);

      const result = await service.rotateSession(SESSION_ID, "any-hash");

      expect(result).toBeNull();
      expect(redisDelete).not.toHaveBeenCalled();
    });
  });

  describe("revokeSession", () => {
    it("удаляет ключ session", async () => {
      await service.revokeSession(SESSION_ID);

      expect(redisDelete).toHaveBeenCalledWith(`auth:session:${SESSION_ID}`);
    });

    it("session с tokenFamilyId отзывается целиком по ключу (§31–32)", async () => {
      await service.createSession(SESSION_ID, USER_ID, "hash", FAMILY_ID);
      await service.revokeSession(SESSION_ID);

      expect(redisDelete).toHaveBeenCalledWith(`auth:session:${SESSION_ID}`);
      const [, raw] = redisSet.mock.calls[0];
      expect(JSON.parse(raw)).toMatchObject({ tokenFamilyId: FAMILY_ID });
    });
  });

  describe("revokeAllUserSessions", () => {
    it("удаляет все сессии пользователя (§66)", async () => {
      const other1 = randomUUID();
      const other2 = randomUUID();
      redisScanKeys.mockResolvedValue([
        `auth:session:${other1}`,
        `auth:session:${other2}`,
      ]);
      redisGet
        .mockResolvedValueOnce(JSON.stringify(createStoredSession("h1")))
        .mockResolvedValueOnce(JSON.stringify(createStoredSession("h2")));

      await service.revokeAllUserSessions(USER_ID);

      expect(redisScanKeys).toHaveBeenCalledWith("auth:session:*");
      expect(redisDelete).toHaveBeenCalledTimes(2);
      expect(redisDelete).toHaveBeenCalledWith(`auth:session:${other1}`);
      expect(redisDelete).toHaveBeenCalledWith(`auth:session:${other2}`);
    });

    it("сессии другого пользователя не удаляются (§66)", async () => {
      const mine = randomUUID();
      const theirs = randomUUID();
      redisScanKeys.mockResolvedValue([
        `auth:session:${mine}`,
        `auth:session:${theirs}`,
      ]);
      redisGet
        .mockResolvedValueOnce(JSON.stringify(createStoredSession("hm")))
        .mockResolvedValueOnce(
          JSON.stringify({ ...createStoredSession("ht"), userId: "other" }),
        );

      await service.revokeAllUserSessions(USER_ID);

      expect(redisDelete).toHaveBeenCalledTimes(1);
      expect(redisDelete).toHaveBeenCalledWith(`auth:session:${mine}`);
      expect(redisDelete).not.toHaveBeenCalledWith(`auth:session:${theirs}`);
    });

    it("нет сессий → no-op", async () => {
      redisScanKeys.mockResolvedValue([]);

      await service.revokeAllUserSessions(USER_ID);

      expect(redisGet).not.toHaveBeenCalled();
      expect(redisDelete).not.toHaveBeenCalled();
    });

    it("сессия с пустым/нулевым значением пропускается", async () => {
      const key = `auth:session:${randomUUID()}`;
      redisScanKeys.mockResolvedValue([key]);
      redisGet.mockResolvedValue(null);

      await service.revokeAllUserSessions(USER_ID);

      expect(redisDelete).not.toHaveBeenCalled();
    });
  });
});
