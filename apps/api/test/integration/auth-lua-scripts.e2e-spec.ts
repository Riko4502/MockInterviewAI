import { randomUUID } from "node:crypto";
import {
  CREATE_SESSION_LUA,
  GET_USER_ACTIVE_SESSIONS_LUA,
  ROTATE_SESSION_LUA,
  UPDATE_MIN_GEN_LUA,
} from "../../src/modules/auth/services/auth-session.service";
import {
  type StartedApp,
  startTestApp,
  stopTestApp,
} from "../helpers/test-app.helper";

describe("Integration (Redis): Auth Lua Scripts Real Redis Execution", () => {
  let started: StartedApp;
  const createdKeys: string[] = [];

  beforeAll(async () => {
    started = await startTestApp();
  });

  afterAll(async () => {
    if (createdKeys.length > 0) {
      for (const key of createdKeys) {
        await started.redis.delete(key).catch(() => undefined);
      }
    }
    await stopTestApp(started);
  });

  afterEach(async () => {
    while (createdKeys.length > 0) {
      const key = createdKeys.pop();
      if (key) {
        await started.redis.delete(key).catch(() => undefined);
      }
    }
  });

  describe("CREATE_SESSION_LUA", () => {
    it("успешно создаёт сессию, выставляет TTL и добавляет её в ZSET активных сессий", async () => {
      const userId = randomUUID();
      const sessionId = randomUUID();
      const minGenKey = `auth:user:${userId}:min_generation`;
      const sessionKey = `auth:session:${sessionId}`;
      const userSessionsKey = `auth:user:${userId}:sessions`;
      createdKeys.push(minGenKey, sessionKey, userSessionsKey);

      const sessionPayload = {
        userId,
        refreshTokenHash: "hash-initial",
        tokenFamilyId: randomUUID(),
        generation: 1,
        createdAt: new Date().toISOString(),
      };
      const nowMs = Date.now();
      const ttl = 300;

      const result = await started.redis.eval<number>(
        CREATE_SESSION_LUA,
        [minGenKey, sessionKey, userSessionsKey],
        [1, JSON.stringify(sessionPayload), ttl, sessionId, nowMs],
      );

      expect(result).toBe(1);

      // Проверяем наличие ключа сессии и корректность данных
      const storedRaw = await started.redis.get(sessionKey);
      expect(storedRaw).not.toBeNull();
      expect(JSON.parse(storedRaw ?? "{}")).toEqual(sessionPayload);

      // Проверяем ZSET: сессия должна быть добавлена со score = nowMs + ttl * 1000
      const expectedScore = nowMs + ttl * 1000;
      const scores = await started.redis.eval<string[]>(
        "return redis.call('zrange', KEYS[1], 0, -1, 'WITHSCORES')",
        [userSessionsKey],
        [],
      );
      expect(scores).toEqual([sessionId, expectedScore.toString()]);
    });

    it("отклоняет создание сессии (возвращает -1), если generation токена < min_generation fence", async () => {
      const userId = randomUUID();
      const sessionId = randomUUID();
      const minGenKey = `auth:user:${userId}:min_generation`;
      const sessionKey = `auth:session:${sessionId}`;
      const userSessionsKey = `auth:user:${userId}:sessions`;
      createdKeys.push(minGenKey, sessionKey, userSessionsKey);

      // Устанавливаем generation fence = 5
      await started.redis.set(minGenKey, "5", 300);

      const sessionPayload = {
        userId,
        refreshTokenHash: "hash-stale",
        tokenFamilyId: randomUUID(),
        generation: 4, // Устаревшее поколение < 5
        createdAt: new Date().toISOString(),
      };
      const nowMs = Date.now();

      const result = await started.redis.eval<number>(
        CREATE_SESSION_LUA,
        [minGenKey, sessionKey, userSessionsKey],
        [4, JSON.stringify(sessionPayload), 300, sessionId, nowMs],
      );

      expect(result).toBe(-1);

      // Сессия и ZSET не должны быть созданы
      expect(await started.redis.get(sessionKey)).toBeNull();
      const zcard = await started.redis.eval<number>(
        "return redis.call('zcard', KEYS[1])",
        [userSessionsKey],
        [],
      );
      expect(zcard).toBe(0);
    });

    it("разрешает создание сессии, если generation токена равен min_generation fence", async () => {
      const userId = randomUUID();
      const sessionId = randomUUID();
      const minGenKey = `auth:user:${userId}:min_generation`;
      const sessionKey = `auth:session:${sessionId}`;
      const userSessionsKey = `auth:user:${userId}:sessions`;
      createdKeys.push(minGenKey, sessionKey, userSessionsKey);

      // Устанавливаем generation fence = 5
      await started.redis.set(minGenKey, "5", 300);

      const sessionPayload = {
        userId,
        refreshTokenHash: "hash-equal",
        tokenFamilyId: randomUUID(),
        generation: 5, // Равно fence (валидно)
        createdAt: new Date().toISOString(),
      };
      const nowMs = Date.now();

      const result = await started.redis.eval<number>(
        CREATE_SESSION_LUA,
        [minGenKey, sessionKey, userSessionsKey],
        [5, JSON.stringify(sessionPayload), 300, sessionId, nowMs],
      );

      expect(result).toBe(1);
      expect(await started.redis.get(sessionKey)).not.toBeNull();
    });

    it("очищает истёкшие сессии из ZSET по nowMs при создании новой сессии", async () => {
      const userId = randomUUID();
      const newSessionId = randomUUID();
      const expiredSessionId = randomUUID();
      const minGenKey = `auth:user:${userId}:min_generation`;
      const sessionKey = `auth:session:${newSessionId}`;
      const userSessionsKey = `auth:user:${userId}:sessions`;
      createdKeys.push(minGenKey, sessionKey, userSessionsKey);

      const nowMs = 1_700_000_000_000;
      const expiredScore = nowMs - 5_000; // Истекла 5 секунд назад

      // Предварительно добавляем истёкшую сессию в ZSET
      await started.redis.eval(
        "return redis.call('zadd', KEYS[1], ARGV[1], ARGV[2])",
        [userSessionsKey],
        [expiredScore, expiredSessionId],
      );

      const sessionPayload = {
        userId,
        refreshTokenHash: "hash-new",
        tokenFamilyId: randomUUID(),
        generation: 1,
        createdAt: new Date().toISOString(),
      };

      const result = await started.redis.eval<number>(
        CREATE_SESSION_LUA,
        [minGenKey, sessionKey, userSessionsKey],
        [1, JSON.stringify(sessionPayload), 300, newSessionId, nowMs],
      );

      expect(result).toBe(1);

      // В ZSET должна остаться только новая сессия, истёкшая удалена
      const activeSessions = await started.redis.eval<string[]>(
        "return redis.call('zrange', KEYS[1], 0, -1)",
        [userSessionsKey],
        [],
      );
      expect(activeSessions).toEqual([newSessionId]);
    });
  });

  describe("UPDATE_MIN_GEN_LUA (Монотонность generation fence)", () => {
    it("монотонно обновляет fence: повышает значение и отклоняет попытки понижения", async () => {
      const userId = randomUUID();
      const minGenKey = `auth:user:${userId}:min_generation`;
      createdKeys.push(minGenKey);

      // Первичная установка min_generation = 10
      const firstUpdate = await started.redis.eval<number>(
        UPDATE_MIN_GEN_LUA,
        [minGenKey],
        [10, 300],
      );
      expect(firstUpdate).toBe(10);
      expect(await started.redis.get(minGenKey)).toBe("10");

      // Попытка понизить fence до 5 — скрипт должен сохранить 10
      const lowerUpdate = await started.redis.eval<number>(
        UPDATE_MIN_GEN_LUA,
        [minGenKey],
        [5, 300],
      );
      expect(lowerUpdate).toBe(10);
      expect(await started.redis.get(minGenKey)).toBe("10");

      // Повышение fence до 15 — скрипт должен обновить до 15
      const higherUpdate = await started.redis.eval<number>(
        UPDATE_MIN_GEN_LUA,
        [minGenKey],
        [15, 300],
      );
      expect(higherUpdate).toBe(15);
      expect(await started.redis.get(minGenKey)).toBe("15");
    });

    it("автоматически инкрементирует текущее значение на 1, если targetMinGen не передан", async () => {
      const userId = randomUUID();
      const minGenKey = `auth:user:${userId}:min_generation`;
      createdKeys.push(minGenKey);

      await started.redis.set(minGenKey, "3", 300);

      const result = await started.redis.eval<number>(
        UPDATE_MIN_GEN_LUA,
        [minGenKey],
        ["", 300],
      );
      expect(result).toBe(4);
      expect(await started.redis.get(minGenKey)).toBe("4");
    });

    it("инициализирует fence значением 1 при автоинкременте, если ключ min_generation ещё не существовал", async () => {
      const userId = randomUUID();
      const minGenKey = `auth:user:${userId}:min_generation`;
      createdKeys.push(minGenKey);

      const result = await started.redis.eval<number>(
        UPDATE_MIN_GEN_LUA,
        [minGenKey],
        ["", 300],
      );
      expect(result).toBe(1);
      expect(await started.redis.get(minGenKey)).toBe("1");
    });
  });

  describe("GET_USER_ACTIVE_SESSIONS_LUA", () => {
    it("очищает истёкшие сессии по (< nowMs) и возвращает только активные ID", async () => {
      const userId = randomUUID();
      const userSessionsKey = `auth:user:${userId}:sessions`;
      createdKeys.push(userSessionsKey);

      const nowMs = 1_700_000_000_000;
      const expiredSession1 = "expired-1";
      const expiredSession2 = "expired-2";
      const activeSession1 = "active-1";
      const activeSession2 = "active-2";

      // Добавляем две истёкшие и две активные сессии
      await started.redis.eval(
        `
        redis.call('zadd', KEYS[1], ARGV[1], ARGV[2])
        redis.call('zadd', KEYS[1], ARGV[3], ARGV[4])
        redis.call('zadd', KEYS[1], ARGV[5], ARGV[6])
        redis.call('zadd', KEYS[1], ARGV[7], ARGV[8])
        `,
        [userSessionsKey],
        [
          nowMs - 10_000,
          expiredSession1,
          nowMs - 1,
          expiredSession2,
          nowMs,
          activeSession1, // Граничное значение: nowMs >= nowMs, не удаляется (строгое '< nowMs')
          nowMs + 60_000,
          activeSession2,
        ],
      );

      const activeIds = await started.redis.eval<string[]>(
        GET_USER_ACTIVE_SESSIONS_LUA,
        [userSessionsKey],
        [nowMs],
      );

      expect(activeIds).toHaveLength(2);
      expect(activeIds).toContain(activeSession1);
      expect(activeIds).toContain(activeSession2);
      expect(activeIds).not.toContain(expiredSession1);
      expect(activeIds).not.toContain(expiredSession2);

      // Проверяем, что в самом ZSET в Redis истёкшие записи также удалены
      const zcard = await started.redis.eval<number>(
        "return redis.call('zcard', KEYS[1])",
        [userSessionsKey],
        [],
      );
      expect(zcard).toBe(2);
    });
  });

  describe("ROTATE_SESSION_LUA", () => {
    it("успешно ротирует refresh token: обновляет refreshTokenHash, lastUsedAt, продлевает ZSET и удаляет истёкшие сессии", async () => {
      const userId = randomUUID();
      const sessionId = randomUUID();
      const expiredSessionId = randomUUID();
      const sessionKey = `auth:session:${sessionId}`;
      const userSessionsKey = `auth:user:${userId}:sessions`;
      createdKeys.push(sessionKey, userSessionsKey);

      const initialSession = {
        userId,
        refreshTokenHash: "old-token-hash",
        tokenFamilyId: randomUUID(),
        generation: 1,
        lastUsedAt: "2026-09-01T00:00:00.000Z",
      };
      await started.redis.set(sessionKey, JSON.stringify(initialSession), 300);

      const nowMs = 1_700_000_000_000;
      const nowIso = new Date(nowMs).toISOString();
      const newHash = "new-token-hash";
      const ttl = 300;

      // Добавляем истёкшую сессию в ZSET
      await started.redis.eval(
        "return redis.call('zadd', KEYS[1], ARGV[1], ARGV[2])",
        [userSessionsKey],
        [nowMs - 1000, expiredSessionId],
      );

      const rawResult = await started.redis.eval<string>(
        ROTATE_SESSION_LUA,
        [sessionKey],
        [newHash, nowIso, nowMs, ttl, sessionId],
      );

      expect(rawResult).not.toBeNull();
      const updated = JSON.parse(rawResult);
      expect(updated.refreshTokenHash).toBe(newHash);
      expect(updated.lastUsedAt).toBe(nowIso);

      // Проверяем обновление сессии в Redis
      const storedRaw = await started.redis.get(sessionKey);
      expect(storedRaw).not.toBeNull();
      const stored = JSON.parse(storedRaw ?? "{}");
      expect(stored.refreshTokenHash).toBe(newHash);
      expect(stored.lastUsedAt).toBe(nowIso);

      // Проверяем обновление ZSET: истёкшая сессия удалена, ротированная обновлена со свежим expire_at_ms
      const expectedScore = nowMs + ttl * 1000;
      const scores = await started.redis.eval<string[]>(
        "return redis.call('zrange', KEYS[1], 0, -1, 'WITHSCORES')",
        [userSessionsKey],
        [],
      );
      expect(scores).toEqual([sessionId, expectedScore.toString()]);
    });

    it("replay detection: если новый хеш совпадает с текущим в сессии, удаляет сессию из Redis и ZSET, возвращает 'REPLAY'", async () => {
      const userId = randomUUID();
      const sessionId = randomUUID();
      const sessionKey = `auth:session:${sessionId}`;
      const userSessionsKey = `auth:user:${userId}:sessions`;
      createdKeys.push(sessionKey, userSessionsKey);

      const currentHash = "current-token-hash";
      const initialSession = {
        userId,
        refreshTokenHash: currentHash,
        tokenFamilyId: randomUUID(),
        generation: 1,
      };

      await started.redis.set(sessionKey, JSON.stringify(initialSession), 300);
      await started.redis.eval(
        "return redis.call('zadd', KEYS[1], ARGV[1], ARGV[2])",
        [userSessionsKey],
        [Date.now() + 300_000, sessionId],
      );

      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();

      // Повторный запрос с тем же самым токеном (replay)
      const result = await started.redis.eval<string>(
        ROTATE_SESSION_LUA,
        [sessionKey],
        [currentHash, nowIso, nowMs, 300, sessionId],
      );

      expect(result).toBe("REPLAY");

      // Сессия должна быть немедленно удалена из Redis
      expect(await started.redis.get(sessionKey)).toBeNull();

      // Сессия должна быть удалена из ZSET пользователя
      const activeIds = await started.redis.eval<string[]>(
        "return redis.call('zrange', KEYS[1], 0, -1)",
        [userSessionsKey],
        [],
      );
      expect(activeIds).not.toContain(sessionId);
    });

    it("возвращает null, если сессия не найдена в Redis", async () => {
      const nonExistentSessionId = randomUUID();
      const sessionKey = `auth:session:${nonExistentSessionId}`;

      const result = await started.redis.eval<string | null>(
        ROTATE_SESSION_LUA,
        [sessionKey],
        [
          "any-hash",
          new Date().toISOString(),
          Date.now(),
          300,
          nonExistentSessionId,
        ],
      );

      expect(result).toBeNull();
    });
  });
});
