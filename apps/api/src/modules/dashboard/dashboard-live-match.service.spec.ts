import { BadRequestException } from "@nestjs/common";
import type { RedisService } from "../../redis/redis.service";
import {
  LiveMatchPostCommitError,
  type SessionsService,
} from "../sessions/sessions.service";
import {
  DashboardLiveMatchService,
  MATCH_OR_ENQUEUE_LUA,
} from "./dashboard-live-match.service";

describe("DashboardLiveMatchService", () => {
  let service: DashboardLiveMatchService;
  let sessionsServiceMock: {
    createLiveMatchSession: jest.Mock;
    warmLiveMatchMirror: jest.Mock;
  };
  let redisMock: {
    zremrangebyscore: jest.Mock;
    zrem: jest.Mock;
    zrange: jest.Mock;
    zadd: jest.Mock;
    expire: jest.Mock;
    publish: jest.Mock;
    eval: jest.Mock;
  };

  beforeEach(() => {
    sessionsServiceMock = {
      createLiveMatchSession: jest.fn().mockResolvedValue({
        sessionId: "live-session-123",
        inviteToken: "token-abc",
      }),
      warmLiveMatchMirror: jest.fn().mockResolvedValue(undefined),
    };
    redisMock = {
      zremrangebyscore: jest.fn().mockResolvedValue(0),
      zrem: jest.fn().mockResolvedValue(1),
      zrange: jest.fn().mockResolvedValue([]),
      zadd: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      publish: jest.fn().mockResolvedValue(1),
      eval: jest.fn().mockResolvedValue(null),
    };
    service = new DashboardLiveMatchService(
      sessionsServiceMock as unknown as SessionsService,
      redisMock as unknown as RedisService,
    );
  });

  it("should throw BadRequestException if specialization is missing", async () => {
    await expect(
      service.toggleLiveMatch("user-1", {
        isSearching: true,
        specialization: undefined as unknown as "FRONTEND",
        level: "MIDDLE",
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("should throw BadRequestException if level is missing", async () => {
    await expect(
      service.toggleLiveMatch("user-1", {
        isSearching: true,
        specialization: "FRONTEND",
        level: undefined as unknown as "MIDDLE",
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("should remove user from redis ZSET queue when isSearching is false", async () => {
    const res = await service.toggleLiveMatch("user-1", {
      isSearching: false,
      specialization: "BACKEND",
      level: "SENIOR",
    });

    expect(res).toEqual({ status: "IDLE" });
    expect(redisMock.zrem).toHaveBeenCalledWith(
      "live_queue:BACKEND:SENIOR",
      "user-1",
    );
  });

  it("should add user to ZSET queue via Lua script when no partner is found and prune stale users", async () => {
    redisMock.eval.mockResolvedValue(null);

    const res = await service.toggleLiveMatch("user-1", {
      isSearching: true,
      specialization: "FRONTEND",
      level: "JUNIOR",
    });

    expect(res).toEqual({
      status: "SEARCHING",
      estimatedWaitSeconds: 45,
    });
    expect(redisMock.zremrangebyscore).toHaveBeenCalledWith(
      "live_queue:FRONTEND:JUNIOR",
      "-inf",
      expect.any(Number),
    );
    expect(redisMock.eval).toHaveBeenCalledWith(
      MATCH_OR_ENQUEUE_LUA,
      1,
      "live_queue:FRONTEND:JUNIOR",
      "user-1",
      expect.any(Number),
      600,
      expect.any(Number),
    );
  });

  it("should match with waiting partner via Lua script, warm mirror via SessionsService and notify partner", async () => {
    redisMock.eval.mockResolvedValue("partner-2");

    const res = await service.toggleLiveMatch("user-1", {
      isSearching: true,
      specialization: "FRONTEND",
      level: "MIDDLE",
    });

    expect(res).toEqual({
      status: "MATCHED",
      sessionId: "live-session-123",
    });
    expect(redisMock.eval).toHaveBeenCalledWith(
      MATCH_OR_ENQUEUE_LUA,
      1,
      "live_queue:FRONTEND:MIDDLE",
      "user-1",
      expect.any(Number),
      600,
      expect.any(Number),
    );
    expect(sessionsServiceMock.createLiveMatchSession).toHaveBeenCalledWith(
      "user-1",
      "partner-2",
    );
    expect(redisMock.publish).toHaveBeenCalledWith(
      "live_match:notify:partner-2",
      JSON.stringify({ sessionId: "live-session-123" }),
    );
  });

  it("should return partner to queue and add user to queue with SEARCHING status when createLiveMatchSession fails before commit", async () => {
    redisMock.eval.mockResolvedValue("partner-2");
    sessionsServiceMock.createLiveMatchSession.mockRejectedValue(
      new Error("Database connection error"),
    );

    const res = await service.toggleLiveMatch("user-1", {
      isSearching: true,
      specialization: "FRONTEND",
      level: "MIDDLE",
    });

    expect(res).toEqual({
      status: "SEARCHING",
      estimatedWaitSeconds: 45,
    });
    expect(sessionsServiceMock.createLiveMatchSession).toHaveBeenCalledWith(
      "user-1",
      "partner-2",
    );
    expect(redisMock.zadd).toHaveBeenCalledWith(
      "live_queue:FRONTEND:MIDDLE",
      expect.any(Number),
      "partner-2",
    );
    expect(redisMock.zadd).toHaveBeenCalledWith(
      "live_queue:FRONTEND:MIDDLE",
      expect.any(Number),
      "user-1",
    );
    expect(redisMock.expire).toHaveBeenCalledWith(
      "live_queue:FRONTEND:MIDDLE",
      600,
    );
    expect(redisMock.publish).not.toHaveBeenCalled();
  });

  it("should preserve session, not return users to queue, and return MATCHED on post-commit error", async () => {
    redisMock.eval.mockResolvedValue("partner-2");
    const postCommitError = new LiveMatchPostCommitError(
      "live-session-123",
      "token-abc",
      new Error("Redis mirror timeout"),
    );
    sessionsServiceMock.createLiveMatchSession.mockRejectedValue(
      postCommitError,
    );

    const res = await service.toggleLiveMatch("user-1", {
      isSearching: true,
      specialization: "FRONTEND",
      level: "MIDDLE",
    });

    expect(res).toEqual({
      status: "MATCHED",
      sessionId: "live-session-123",
    });
    // Ни партнёр, ни пользователь НЕ возвращаются в очередь!
    expect(redisMock.zadd).not.toHaveBeenCalled();
    // Идемпотентный retry прогрева зеркала сессии
    expect(sessionsServiceMock.warmLiveMatchMirror).toHaveBeenCalledWith(
      "live-session-123",
      "user-1",
      "partner-2",
      "token-abc",
    );
    // Публикация уведомления напарнику
    expect(redisMock.publish).toHaveBeenCalledWith(
      "live_match:notify:partner-2",
      JSON.stringify({ sessionId: "live-session-123" }),
    );
  });
});
