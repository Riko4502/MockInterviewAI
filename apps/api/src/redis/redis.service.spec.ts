import { EventEmitter } from "node:events";
import type { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import type { MetricsService } from "../common/metrics/metrics.service";
import { RedisService } from "./redis.service";

const mockRedisEvents = new EventEmitter();

const mockRedisInstance = {
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue("OK"),
  disconnect: jest.fn(),
  on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
    mockRedisEvents.on(event, handler);
  }),
  emit: mockRedisEvents.emit.bind(mockRedisEvents),
  set: jest.fn().mockResolvedValue("OK"),
  get: jest.fn().mockResolvedValue(null),
  mget: jest.fn().mockResolvedValue([]),
  del: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  ping: jest.fn().mockResolvedValue("PONG"),
  eval: jest.fn().mockResolvedValue(1),
  scanStream: jest.fn(),
  xadd: jest.fn().mockResolvedValue("1724500000000-0"),
};

jest.mock("ioredis", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockRedisInstance),
  };
});

function createConfigService(overrides?: Record<string, unknown>) {
  const defaults: Record<string, unknown> = {
    "redis.host": "localhost",
    "redis.port": 6379,
    "redis.password": "test-password",
  };
  return {
    get: jest
      .fn()
      .mockImplementation((key: string) => overrides?.[key] ?? defaults[key]),
  } as unknown as ConfigService;
}

function createMetricsService(): MetricsService {
  return {
    setRedisStatus: jest.fn(),
    incRedisError: jest.fn(),
  } as unknown as MetricsService;
}

describe("RedisService", () => {
  let service: RedisService;
  let metricsService: MetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisEvents.removeAllListeners();
    metricsService = createMetricsService();
    service = new RedisService(createConfigService(), metricsService);
  });

  describe("onModuleInit", () => {
    it("создаёт Redis клиент с конфигурацией и bounded-retry", async () => {
      await service.onModuleInit();
      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "localhost",
          port: 6379,
          password: "test-password",
          lazyConnect: true,
          maxRetriesPerRequest: 1,
        }),
      );
    });

    it("вызывает connect()", async () => {
      await service.onModuleInit();
      expect(mockRedisInstance.connect).toHaveBeenCalledTimes(1);
    });

    it("использует дефолты если конфиг не задан", async () => {
      const config = createConfigService({});
      const svc = new RedisService(config, createMetricsService());
      await svc.onModuleInit();
      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({ host: "localhost", port: 6379 }),
      );
    });
  });

  describe("onModuleDestroy", () => {
    it("вызывает quit()", async () => {
      await service.onModuleInit();
      await service.onModuleDestroy();
      expect(mockRedisInstance.quit).toHaveBeenCalledTimes(1);
    });

    it("при отказе quit() использует disconnect()", async () => {
      await service.onModuleInit();
      mockRedisInstance.quit.mockRejectedValueOnce(
        new Error("The connection is already closed"),
      );

      await service.onModuleDestroy();

      expect(mockRedisInstance.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("connection events", () => {
    it("обновляет метрику статуса на ready", async () => {
      await service.onModuleInit();

      mockRedisInstance.emit("ready");

      expect(metricsService.setRedisStatus).toHaveBeenCalledWith("ready");
    });

    it("классифицирует ECONNREFUSED как ошибку", async () => {
      await service.onModuleInit();

      mockRedisInstance.emit(
        "error",
        new Error("connect ECONNREFUSED 127.0.0.1:6379"),
      );

      expect(metricsService.setRedisStatus).toHaveBeenCalledWith("error");
      expect(metricsService.incRedisError).toHaveBeenCalledWith("ECONNREFUSED");
    });

    it("классифицирует ECONNRESET как ошибку", async () => {
      await service.onModuleInit();

      mockRedisInstance.emit("error", new Error("read ECONNRESET"));

      expect(metricsService.incRedisError).toHaveBeenCalledWith("ECONNRESET");
    });

    it("классифицирует NOAUTH как ошибку", async () => {
      await service.onModuleInit();

      mockRedisInstance.emit(
        "error",
        new Error("NOAUTH Authentication required"),
      );

      expect(metricsService.incRedisError).toHaveBeenCalledWith("NOAUTH");
    });

    it("классифицирует ETIMEDOUT как ошибку", async () => {
      await service.onModuleInit();

      mockRedisInstance.emit("error", new Error("connect ETIMEDOUT"));

      expect(metricsService.incRedisError).toHaveBeenCalledWith("ETIMEDOUT");
    });

    it("относит неизвестные ошибки к other", async () => {
      await service.onModuleInit();

      mockRedisInstance.emit("error", new Error("something unexpected"));

      expect(metricsService.incRedisError).toHaveBeenCalledWith("other");
    });

    it("обновляет метрику статуса на close", async () => {
      await service.onModuleInit();

      mockRedisInstance.emit("close");

      expect(metricsService.setRedisStatus).toHaveBeenCalledWith("close");
    });

    it("обновляет метрику статуса на reconnecting", async () => {
      await service.onModuleInit();

      mockRedisInstance.emit("reconnecting");

      expect(metricsService.setRedisStatus).toHaveBeenCalledWith(
        "reconnecting",
      );
    });
  });

  describe("set", () => {
    it("устанавливает ключ без TTL", async () => {
      await service.onModuleInit();
      await service.set("foo", "bar");
      expect(mockRedisInstance.set).toHaveBeenCalledWith("foo", "bar");
    });

    it("устанавливает ключ с TTL", async () => {
      await service.onModuleInit();
      await service.set("foo", "bar", 3600);
      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        "foo",
        "bar",
        "EX",
        3600,
      );
    });
  });

  describe("xadd", () => {
    it("writes the payload field consumed by realtime", async () => {
      await service.onModuleInit();
      const payload = { id: "n1", title: "Title", message: "Message" };
      const stream = "user:u1:notifications";

      await expect(
        service.xadd(stream, "notification.new", payload, 100, 604800),
      ).resolves.toBe("1724500000000-0");

      expect(mockRedisInstance.xadd).toHaveBeenCalledWith(
        stream,
        "MAXLEN",
        "~",
        100,
        "*",
        "type",
        "notification.new",
        "payload",
        JSON.stringify(payload),
      );
      expect(mockRedisInstance.expire).toHaveBeenCalledWith(stream, 604800);
    });
  });

  describe("get", () => {
    it("возвращает значение", async () => {
      mockRedisInstance.get.mockResolvedValue("hello");
      await service.onModuleInit();
      const result = await service.get("foo");
      expect(result).toBe("hello");
      expect(mockRedisInstance.get).toHaveBeenCalledWith("foo");
    });

    it("возвращает null если ключ не существует", async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      await service.onModuleInit();
      const result = await service.get("missing");
      expect(result).toBeNull();
    });
  });

  describe("mget", () => {
    it("возвращает массив значений", async () => {
      mockRedisInstance.mget.mockResolvedValue(["val1", "val2"]);
      await service.onModuleInit();
      const result = await service.mget(["k1", "k2"]);
      expect(result).toEqual(["val1", "val2"]);
      expect(mockRedisInstance.mget).toHaveBeenCalledWith("k1", "k2");
    });

    it("возвращает пустой массив если передан пустой список ключей", async () => {
      await service.onModuleInit();
      const result = await service.mget([]);
      expect(result).toEqual([]);
      expect(mockRedisInstance.mget).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("удаляет ключ", async () => {
      await service.onModuleInit();
      await service.delete("foo");
      expect(mockRedisInstance.del).toHaveBeenCalledWith("foo");
    });
  });

  describe("expire", () => {
    it("устанавливает TTL", async () => {
      await service.onModuleInit();
      await service.expire("foo", 60);
      expect(mockRedisInstance.expire).toHaveBeenCalledWith("foo", 60);
    });
  });

  describe("ping", () => {
    it("возвращает PONG", async () => {
      await service.onModuleInit();
      const result = await service.ping();
      expect(result).toBe("PONG");
      expect(mockRedisInstance.ping).toHaveBeenCalledTimes(1);
    });
  });

  describe("eval", () => {
    it("выполняет Lua-скрипт с ключами и аргументами", async () => {
      mockRedisInstance.eval.mockResolvedValue(1);
      await service.onModuleInit();
      const result = await service.eval("return 1", ["k1", "k2"], ["a1", 10]);
      expect(result).toBe(1);
      expect(mockRedisInstance.eval).toHaveBeenCalledWith(
        "return 1",
        2,
        "k1",
        "k2",
        "a1",
        10,
      );
    });
  });

  describe("scanKeys", () => {
    function mockStream() {
      const stream = new EventEmitter();
      mockRedisInstance.scanStream.mockReturnValue(stream);
      return stream;
    }

    it("собирает ключи из пачек стрима", async () => {
      const stream = mockStream();
      await service.onModuleInit();

      const promise = service.scanKeys("auth:session:*", 100);
      stream.emit("data", ["auth:session:a", "auth:session:b"]);
      stream.emit("data", ["auth:session:c"]);
      stream.emit("end");

      const result = await promise;
      expect(result).toEqual([
        "auth:session:a",
        "auth:session:b",
        "auth:session:c",
      ]);
      expect(mockRedisInstance.scanStream).toHaveBeenCalledWith({
        match: "auth:session:*",
        count: 100,
      });
    });

    it("без ключей возвращает пустой массив", async () => {
      const stream = mockStream();
      await service.onModuleInit();

      const promise = service.scanKeys("missing:*");
      stream.emit("end");

      await expect(promise).resolves.toEqual([]);
    });

    it("реектит promise при ошибке стрима (§66)", async () => {
      const stream = mockStream();
      await service.onModuleInit();

      const promise = service.scanKeys("auth:session:*");
      stream.emit("error", new Error("redis down"));

      await expect(promise).rejects.toThrow("redis down");
    });
  });
});
