import type { RedisService } from "../../redis/redis.service";
import { DashboardCacheService } from "./dashboard-cache.service";

describe("DashboardCacheService", () => {
  let service: DashboardCacheService;
  let redisMock: {
    get: jest.Mock;
    set: jest.Mock;
    delete: jest.Mock;
    scanKeys: jest.Mock;
  };

  beforeEach(() => {
    redisMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue("OK"),
      delete: jest.fn().mockResolvedValue(1),
      scanKeys: jest.fn().mockResolvedValue([]),
    };
    service = new DashboardCacheService(redisMock as unknown as RedisService);
  });

  describe("getOrSet", () => {
    it("returns cached value if available in Redis without calling fallback", async () => {
      const cachedData = { foo: "bar" };
      redisMock.get.mockResolvedValue(JSON.stringify(cachedData));
      const fallback = jest.fn();

      const result = await service.getOrSet("cache:test", 60, fallback);

      expect(result).toEqual(cachedData);
      expect(redisMock.get).toHaveBeenCalledWith("cache:test");
      expect(fallback).not.toHaveBeenCalled();
      expect(redisMock.set).not.toHaveBeenCalled();
    });

    it("calls fallback, caches result and returns fresh data if cache is empty", async () => {
      const freshData = { count: 42 };
      const fallback = jest.fn().mockResolvedValue(freshData);

      const result = await service.getOrSet("cache:test", 60, fallback);

      expect(result).toEqual(freshData);
      expect(redisMock.get).toHaveBeenCalledWith("cache:test");
      expect(fallback).toHaveBeenCalledTimes(1);
      expect(redisMock.set).toHaveBeenCalledWith(
        "cache:test",
        JSON.stringify(freshData),
        60,
      );
    });

    it("gracefully falls back to fallback if redis.get throws an error", async () => {
      redisMock.get.mockRejectedValue(new Error("Redis offline"));
      const fallback = jest.fn().mockResolvedValue({ fallback: true });

      const result = await service.getOrSet("cache:error", 30, fallback);

      expect(result).toEqual({ fallback: true });
      expect(fallback).toHaveBeenCalledTimes(1);
    });
  });

  describe("invalidate", () => {
    it("calls redis.delete with the provided key", async () => {
      await service.invalidate("cache:dashboard:upcoming:user-1");
      expect(redisMock.delete).toHaveBeenCalledWith(
        "cache:dashboard:upcoming:user-1",
      );
    });
  });

  describe("invalidatePattern", () => {
    it("scans keys and deletes all matched keys", async () => {
      redisMock.scanKeys.mockResolvedValue([
        "cache:dashboard:recent:user-1:5",
        "cache:dashboard:recent:user-1:10",
      ]);

      await service.invalidatePattern("cache:dashboard:recent:user-1:*");

      expect(redisMock.scanKeys).toHaveBeenCalledWith(
        "cache:dashboard:recent:user-1:*",
      );
      expect(redisMock.delete).toHaveBeenCalledWith(
        "cache:dashboard:recent:user-1:5",
      );
      expect(redisMock.delete).toHaveBeenCalledWith(
        "cache:dashboard:recent:user-1:10",
      );
    });

    it("does nothing if no keys match pattern", async () => {
      redisMock.scanKeys.mockResolvedValue([]);

      await service.invalidatePattern("cache:dashboard:recent:empty:*");

      expect(redisMock.delete).not.toHaveBeenCalled();
    });
  });

  describe("invalidateUserSessions", () => {
    it("invalidates upcoming, stats, readiness and recent patterns for user (TASK-BACK-45)", async () => {
      redisMock.scanKeys.mockResolvedValue([
        "cache:dashboard:recent:user-123:5",
      ]);

      await service.invalidateUserSessions("user-123");

      expect(redisMock.delete).toHaveBeenCalledWith(
        "cache:dashboard:upcoming:user-123",
      );
      expect(redisMock.delete).toHaveBeenCalledWith(
        "cache:dashboard:stats:user-123",
      );
      expect(redisMock.delete).toHaveBeenCalledWith(
        "cache:dashboard:readiness:user-123",
      );
      expect(redisMock.scanKeys).toHaveBeenCalledWith(
        "cache:dashboard:recent:user-123:*",
      );
      expect(redisMock.delete).toHaveBeenCalledWith(
        "cache:dashboard:recent:user-123:5",
      );
    });
  });

  describe("invalidateUserReadiness", () => {
    it("invalidates readiness cache for user", async () => {
      await service.invalidateUserReadiness("user-123");
      expect(redisMock.delete).toHaveBeenCalledWith(
        "cache:dashboard:readiness:user-123",
      );
    });
  });

  describe("invalidateUserShowcase", () => {
    it("invalidates showcase and readiness cache for user", async () => {
      await service.invalidateUserShowcase("user-123");
      expect(redisMock.delete).toHaveBeenCalledWith(
        "cache:dashboard:showcase:user-123",
      );
      expect(redisMock.delete).toHaveBeenCalledWith(
        "cache:dashboard:readiness:user-123",
      );
    });
  });
});
