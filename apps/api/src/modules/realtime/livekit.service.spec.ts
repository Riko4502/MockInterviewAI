import { ForbiddenException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { MediaTokenResponseDto } from "@packages/dto";
import jwt from "jsonwebtoken";
import type { RedisService } from "../../redis/redis.service";
import { LivekitService } from "./livekit.service";

const API_KEY = "devkey";
const API_SECRET = "secret";
const SERVER_URL = "ws://localhost:7880";
const TOKEN_TTL = 1800;

describe("LivekitService", () => {
  let redisMock: {
    get: jest.Mock;
    hget: jest.Mock;
  };
  let configMock: { get: jest.Mock; getOrThrow: jest.Mock };
  let service: LivekitService;

  const sessionId = "11111111-1111-4111-a111-111111111111";
  const userId = "22222222-2222-4222-b222-222222222222";

  function mockConfig(map: Record<string, unknown>): void {
    configMock.get.mockImplementation((key: string) =>
      key === "livekit.tokenTtlSeconds" ? (map[key] ?? TOKEN_TTL) : undefined,
    );
    configMock.getOrThrow.mockImplementation((key: string) => {
      if (key === "livekit.apiKey") return map[key] ?? API_KEY;
      if (key === "livekit.apiSecret") return map[key] ?? API_SECRET;
      if (key === "livekit.url") return map[key] ?? SERVER_URL;
      throw new Error(`unexpected key ${key}`);
    });
  }

  function decodeVideo(raw: MediaTokenResponseDto): {
    iss: string;
    sub: string;
    nbf: number;
    exp: number;
    video: {
      room: string;
      roomJoin: boolean;
      canPublish: boolean;
      canSubscribe: boolean;
      canPublishData: boolean;
      roomAdmin: boolean;
      roomRecord: boolean;
      canPublishSources?: string[];
    };
  } {
    const payload = jwt.decode(raw.token) as jwt.JwtPayload;
    return payload as never;
  }

  beforeEach(() => {
    redisMock = {
      get: jest.fn(),
      hget: jest.fn(),
    };
    configMock = { get: jest.fn(), getOrThrow: jest.fn() };
    mockConfig({});
    service = new LivekitService(
      redisMock as unknown as RedisService,
      configMock as unknown as ConfigService,
    );
  });

  describe("grants по роли (§4.1)", () => {
    it("INTERVIEWER публикует camera/mic/screen_share, canPublishData=false", async () => {
      redisMock.get.mockResolvedValue("true");
      redisMock.hget.mockResolvedValue("INTERVIEWER");

      const res = await service.generateMediaToken(userId, sessionId);

      expect(res.serverUrl).toBe(SERVER_URL);
      expect(res.roomName).toBe(sessionId);
      const video = decodeVideo(res).video;
      expect(video.room).toBe(sessionId);
      expect(video.roomJoin).toBe(true);
      expect(video.canPublish).toBe(true);
      expect(video.canPublishSources).toEqual([
        "camera",
        "microphone",
        "screen_share",
      ]);
      expect(video.canSubscribe).toBe(true);
      expect(video.canPublishData).toBe(false);
      expect(video.roomAdmin).toBe(false);
      expect(video.roomRecord).toBe(false);
    });

    it("CANDIDATE публикует только camera/mic без screen_share", async () => {
      redisMock.get.mockResolvedValue("true");
      redisMock.hget.mockResolvedValue("CANDIDATE");

      const res = await service.generateMediaToken(userId, sessionId);
      const video = decodeVideo(res).video;

      expect(video.canPublish).toBe(true);
      expect(video.canPublishSources).toEqual(["camera", "microphone"]);
      expect(video.canPublishSources).not.toContain("screen_share");
    });

    it("OBSERVER — subscribe-only (canPublish=false)", async () => {
      redisMock.get.mockResolvedValue("true");
      redisMock.hget.mockResolvedValue("OBSERVER");

      const res = await service.generateMediaToken(userId, sessionId);
      const video = decodeVideo(res).video;

      expect(video.canPublish).toBe(false);
      expect(video.canPublishSources).toBeUndefined();
      expect(video.canSubscribe).toBe(true);
      expect(video.canPublishData).toBe(false);
    });
  });

  describe("claims токена", () => {
    it("iss=apiKey, sub=userId, room=sessionId, exp−nbf=TTL", async () => {
      redisMock.get.mockResolvedValue("true");
      redisMock.hget.mockResolvedValue("INTERVIEWER");

      const res = await service.generateMediaToken(userId, sessionId);
      const payload = decodeVideo(res);

      expect(payload.iss).toBe(API_KEY);
      expect(payload.sub).toBe(userId);
      expect(payload.video.room).toBe(sessionId);
      expect(payload.exp - payload.nbf).toBe(TOKEN_TTL);
    });
  });

  describe("fail-closed", () => {
    it("403 при неактивной сессии", async () => {
      redisMock.get.mockResolvedValue("closed");
      redisMock.hget.mockResolvedValue("INTERVIEWER");

      await expect(
        service.generateMediaToken(userId, sessionId),
      ).rejects.toThrow(ForbiddenException);
    });

    it("403 при отсутствующей записи активности", async () => {
      redisMock.get.mockResolvedValue(null);
      redisMock.hget.mockResolvedValue("INTERVIEWER");

      await expect(
        service.generateMediaToken(userId, sessionId),
      ).rejects.toThrow(ForbiddenException);
    });

    it("403 при отсутствии участника в members", async () => {
      redisMock.get.mockResolvedValue("true");
      redisMock.hget.mockResolvedValue(null);

      await expect(
        service.generateMediaToken(userId, sessionId),
      ).rejects.toThrow(ForbiddenException);
    });

    it("403 при неизвестном значении роли", async () => {
      redisMock.get.mockResolvedValue("true");
      redisMock.hget.mockResolvedValue("ADMIN");

      await expect(
        service.generateMediaToken(userId, sessionId),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
