import { BadRequestException } from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import type { RedisService } from "../../redis/redis.service";
import { DashboardLiveMatchService } from "./dashboard-live-match.service";

describe("DashboardLiveMatchService", () => {
  let service: DashboardLiveMatchService;
  let prismaMock: { interviewSession: { create: jest.Mock } };
  let redisMock: {
    srem: jest.Mock;
    spop: jest.Mock;
    sadd: jest.Mock;
    expire: jest.Mock;
    publish: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = {
      interviewSession: {
        create: jest.fn(),
      },
    };
    redisMock = {
      srem: jest.fn().mockResolvedValue(1),
      spop: jest.fn().mockResolvedValue(null),
      sadd: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      publish: jest.fn().mockResolvedValue(1),
    };
    service = new DashboardLiveMatchService(
      prismaMock as unknown as PrismaService,
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

  it("should remove user from redis queue when isSearching is false", async () => {
    const res = await service.toggleLiveMatch("user-1", {
      isSearching: false,
      specialization: "BACKEND",
      level: "SENIOR",
    });

    expect(res).toEqual({ status: "IDLE" });
    expect(redisMock.srem).toHaveBeenCalledWith(
      "live_queue:BACKEND:SENIOR",
      "user-1",
    );
  });

  it("should add user to queue when no partner is found", async () => {
    const res = await service.toggleLiveMatch("user-1", {
      isSearching: true,
      specialization: "FRONTEND",
      level: "JUNIOR",
    });

    expect(res).toEqual({
      status: "SEARCHING",
      estimatedWaitSeconds: 45,
    });
    expect(redisMock.sadd).toHaveBeenCalledWith(
      "live_queue:FRONTEND:JUNIOR",
      "user-1",
    );
  });
});
