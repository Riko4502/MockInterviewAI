import { BadRequestException } from "@nestjs/common";
import type { RedisService } from "../../redis/redis.service";
import type { SessionsService } from "../sessions/sessions.service";
import { DashboardLiveMatchService } from "./dashboard-live-match.service";

describe("DashboardLiveMatchService", () => {
  let service: DashboardLiveMatchService;
  let sessionsServiceMock: {
    createLiveMatchSession: jest.Mock;
  };
  let redisMock: {
    zremrangebyscore: jest.Mock;
    zrem: jest.Mock;
    zrange: jest.Mock;
    zadd: jest.Mock;
    expire: jest.Mock;
    publish: jest.Mock;
  };

  beforeEach(() => {
    sessionsServiceMock = {
      createLiveMatchSession: jest.fn().mockResolvedValue({
        sessionId: "live-session-123",
        inviteToken: "token-abc",
      }),
    };
    redisMock = {
      zremrangebyscore: jest.fn().mockResolvedValue(0),
      zrem: jest.fn().mockResolvedValue(1),
      zrange: jest.fn().mockResolvedValue([]),
      zadd: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      publish: jest.fn().mockResolvedValue(1),
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

  it("should add user to ZSET queue when no partner is found and prune stale users", async () => {
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
    expect(redisMock.zadd).toHaveBeenCalledWith(
      "live_queue:FRONTEND:JUNIOR",
      expect.any(Number),
      "user-1",
    );
    expect(redisMock.expire).toHaveBeenCalledWith(
      "live_queue:FRONTEND:JUNIOR",
      600,
    );
  });

  it("should match with waiting partner, warm mirror via SessionsService and notify partner", async () => {
    redisMock.zrange.mockResolvedValue(["partner-2"]);
    redisMock.zrem.mockResolvedValue(1);

    const res = await service.toggleLiveMatch("user-1", {
      isSearching: true,
      specialization: "FRONTEND",
      level: "MIDDLE",
    });

    expect(res).toEqual({
      status: "MATCHED",
      sessionId: "live-session-123",
    });
    expect(sessionsServiceMock.createLiveMatchSession).toHaveBeenCalledWith(
      "user-1",
      "partner-2",
    );
    expect(redisMock.publish).toHaveBeenCalledWith(
      "live_match:notify:partner-2",
      JSON.stringify({ sessionId: "live-session-123" }),
    );
  });
});
