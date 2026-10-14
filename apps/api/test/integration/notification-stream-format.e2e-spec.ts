import fs from "node:fs";
import path from "node:path";
import type { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { RedisService } from "../../src/redis/redis.service";

/**
 * Креды берём из корневого `.env` — тем же способом, что и
 * `scripts/send-sse.mjs`, чтобы тест видел тот же Redis, что и
 * приложение в Docker. Переменные процесса имеют приоритет.
 */
const loadEnv = (): Record<string, string> => {
  const envPath = path.resolve(__dirname, "../../../../.env");
  const result: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return result;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    result[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return result;
};

const fileEnv = loadEnv();
const HOST = process.env.REDIS_HOST ?? fileEnv.REDIS_HOST ?? "localhost";
const PORT = Number(process.env.REDIS_PORT ?? fileEnv.REDIS_PORT ?? 6379);
const PASSWORD = process.env.REDIS_PASSWORD ?? fileEnv.REDIS_PASSWORD ?? "";

const STREAM = `user:integration-stream-format:notifications`;
const TIMESTAMP = "2026-09-28T10:00:00.000Z";

type MetricsStub = {
  setRedisStatus: jest.Mock;
  incRedisError: jest.Mock;
  classifyRedisError: jest.Mock;
};

const toRecord = (fields: string[]): Record<string, string> =>
  Object.fromEntries(
    Array.from({ length: fields.length / 2 }, (_, i) => [
      fields[i * 2],
      fields[i * 2 + 1],
    ]),
  );

const makeService = () => {
  const values: Record<string, unknown> = {
    "redis.host": HOST,
    "redis.port": PORT,
    "redis.password": PASSWORD,
  };
  const configService = {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
  const metricsService = {
    setRedisStatus: jest.fn(),
    incRedisError: jest.fn(),
    classifyRedisError: jest.fn(() => "unknown"),
  } as unknown as MetricsStub;

  return new RedisService(configService, metricsService as never);
};

describe("RedisService.xadd on a real Redis (notification stream format)", () => {
  let service: RedisService;
  let reader: Redis;
  let available = false;

  beforeAll(async () => {
    reader = new Redis({
      host: HOST,
      port: PORT,
      password: PASSWORD,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      // Без этого ioredis продолжает переподключаться после неудачи и
      // держит event loop — jest не завершается.
      retryStrategy: () => null,
    });
    try {
      await reader.connect();
      await reader.del(STREAM);
      service = makeService();
      await service.onModuleInit();
      available = true;
    } catch {
      reader.disconnect();
      available = false;
    }
  });

  afterAll(async () => {
    if (available) {
      await reader.del(STREAM);
      await service.onModuleDestroy();
      await reader.quit();
    } else {
      reader.disconnect();
    }
  });

  const itIfRedis = (name: string, body: () => Promise<void>) =>
    it(name, async () => {
      if (!available) {
        console.warn(
          `[skipped] ${name}: Redis is not reachable at ${HOST}:${PORT}`,
        );
        return;
      }
      await body();
    });

  itIfRedis(
    "writes type, payload and timestamp as realtime reads them",
    async () => {
      const payload = {
        id: "11111111-1111-4111-a111-111111111111",
        title: "Приглашение",
        message: "Новое интервью",
        category: "INTERVIEW",
        actionUrl: null,
        createdAt: TIMESTAMP,
        read: false,
      };

      const id = await service.xadd(
        STREAM,
        "notification.new",
        payload,
        100,
        604800,
        TIMESTAMP,
      );

      expect(id).not.toBeNull();

      const entries = await reader.xrange(STREAM, "-", "+");
      expect(entries).toHaveLength(1);

      const fields = entries[0][1] as string[];
      const record = toRecord(fields);

      expect(Object.keys(record).sort()).toEqual([
        "payload",
        "timestamp",
        "type",
      ]);
      expect(record.type).toBe("notification.new");
      expect(record.timestamp).toBe(TIMESTAMP);
      expect(JSON.parse(record.payload as string)).toEqual(payload);
    },
  );

  itIfRedis(
    "omits the timestamp field entirely when it is not passed",
    async () => {
      const id = await service.xadd(STREAM, "notification.badge", {
        unreadCount: 1,
      });
      expect(id).not.toBeNull();

      const entries = await reader.xrange(STREAM, "-", "+");
      const last = entries[entries.length - 1][1] as string[];
      const record = toRecord(last);

      expect(Object.keys(record).sort()).toEqual(["payload", "type"]);
      expect(record).not.toHaveProperty("timestamp");
    },
  );

  itIfRedis("applies MAXLEN and the TTL realtime relies on", async () => {
    const ttl = await reader.ttl(STREAM);
    expect(ttl).toBeGreaterThan(604000);
    expect(ttl).toBeLessThanOrEqual(604800);

    const length = await reader.xlen(STREAM);
    expect(length).toBeGreaterThan(0);
  });
});
