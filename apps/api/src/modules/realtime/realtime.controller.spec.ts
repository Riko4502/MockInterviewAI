import { ForbiddenException } from "@nestjs/common";
import type { RedisService } from "../../redis/redis.service";
import type { TokenService } from "../auth/services/token.service";
import type { LivekitService } from "./livekit.service";
import { RealtimeController } from "./realtime.controller";

describe("RealtimeController", () => {
  let controller: RealtimeController;
  let tokenServiceMock: { generateRealtimeTicket: jest.Mock };
  let livekitServiceMock: { generateMediaToken: jest.Mock };
  let redisMock: { get: jest.Mock; hget: jest.Mock };

  const userId = "user-uuid-1";
  const sid = "sid-uuid-1";
  const sessionId = "session-uuid-1";

  beforeEach(() => {
    tokenServiceMock = {
      generateRealtimeTicket: jest.fn().mockReturnValue("jwt-ticket-mock"),
    };
    livekitServiceMock = {
      generateMediaToken: jest.fn().mockResolvedValue({
        token: "livekit-token-mock",
        serverUrl: "wss://livekit.example.com",
        roomName: sessionId,
      }),
    };
    redisMock = {
      get: jest.fn(),
      hget: jest.fn(),
    };

    controller = new RealtimeController(
      tokenServiceMock as unknown as TokenService,
      livekitServiceMock as unknown as LivekitService,
      redisMock as unknown as RedisService,
    );
  });

  describe("getTicket", () => {
    it("выдаёт тикет для валидного участника активной сессии", async () => {
      redisMock.get.mockResolvedValue("true");
      redisMock.hget.mockResolvedValue("CANDIDATE");

      const result = await controller.getTicket({ sessionId }, userId, sid);

      expect(result).toEqual({ ticket: "jwt-ticket-mock" });
      expect(redisMock.get).toHaveBeenCalledWith(`session:${sessionId}:active`);
      expect(redisMock.hget).toHaveBeenCalledWith(
        `session:${sessionId}:members`,
        userId,
      );
      expect(tokenServiceMock.generateRealtimeTicket).toHaveBeenCalledWith(
        userId,
        sid,
        sessionId,
      );
    });

    it("бросает ForbiddenException если сессия не активна в Redis", async () => {
      redisMock.get.mockResolvedValue(null);
      redisMock.hget.mockResolvedValue("CANDIDATE");

      await expect(
        controller.getTicket({ sessionId }, userId, sid),
      ).rejects.toThrow(ForbiddenException);

      expect(tokenServiceMock.generateRealtimeTicket).not.toHaveBeenCalled();
    });

    it("бросает ForbiddenException если пользователь не является участником в Redis", async () => {
      redisMock.get.mockResolvedValue("true");
      redisMock.hget.mockResolvedValue(null);

      await expect(
        controller.getTicket({ sessionId }, userId, sid),
      ).rejects.toThrow(ForbiddenException);

      expect(tokenServiceMock.generateRealtimeTicket).not.toHaveBeenCalled();
    });
  });

  describe("getMediaToken", () => {
    it("делегирует генерацию токена в LivekitService", async () => {
      const result = await controller.getMediaToken({ sessionId }, userId);

      expect(result).toEqual({
        token: "livekit-token-mock",
        serverUrl: "wss://livekit.example.com",
        roomName: sessionId,
      });
      expect(livekitServiceMock.generateMediaToken).toHaveBeenCalledWith(
        userId,
        sessionId,
      );
    });
  });
});
