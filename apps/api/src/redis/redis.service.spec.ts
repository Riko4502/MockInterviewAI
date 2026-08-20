import type { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { RedisService } from "./redis.service";

const mockRedisInstance = {
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue("OK"),
  set: jest.fn().mockResolvedValue("OK"),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  ping: jest.fn().mockResolvedValue("PONG"),
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

describe("RedisService", () => {
  let service: RedisService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RedisService(createConfigService());
  });

  describe("onModuleInit", () => {
    it("создаёт Redis клиент с конфигурацией", async () => {
      await service.onModuleInit();
      expect(Redis).toHaveBeenCalledWith({
        host: "localhost",
        port: 6379,
        password: "test-password",
        lazyConnect: false,
      });
    });

    it("вызывает connect()", async () => {
      await service.onModuleInit();
      expect(mockRedisInstance.connect).toHaveBeenCalledTimes(1);
    });

    it("использует дефолты если конфиг не задан", async () => {
      const config = createConfigService({});
      const svc = new RedisService(config);
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
});
