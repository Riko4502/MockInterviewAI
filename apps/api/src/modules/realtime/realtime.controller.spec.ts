import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { RedisService } from "../../redis/redis.service";
import type { TokenService } from "../auth/services/token.service";
import type { LivekitService } from "./livekit.service";
import { RealtimeController } from "./realtime.controller";

describe("RealtimeController", () => {
  let controller: RealtimeController;
  let tokenServiceMock: { generateRealtimeTicket: jest.Mock };
  let livekitServiceMock: { generateMediaToken: jest.Mock };
  let redisMock: { get: jest.Mock; hget: jest.Mock };

  const userId = "00000000-0000-0000-0000-000000000002";
  const sid = "00000000-0000-0000-0000-000000000003";
  const sessionId = "00000000-0000-0000-0000-000000000001";
  const generation = 1;

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
    it("выдаёт тикет для валидного участника активной сессии с generation", async () => {
      redisMock.get.mockResolvedValue("true");
      redisMock.hget.mockResolvedValue("CANDIDATE");

      const result = await controller.getTicket(
        { sessionId },
        userId,
        sid,
        generation,
      );

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
        generation,
      );
    });

    it("бросает UnauthorizedException если generation отсутствует", async () => {
      await expect(
        controller.getTicket({ sessionId }, userId, sid, undefined),
      ).rejects.toThrow(UnauthorizedException);

      expect(redisMock.get).not.toHaveBeenCalled();
      expect(tokenServiceMock.generateRealtimeTicket).not.toHaveBeenCalled();
    });

    it("бросает ForbiddenException если сессия не активна в Redis", async () => {
      redisMock.get.mockResolvedValue(null);
      redisMock.hget.mockResolvedValue("CANDIDATE");

      await expect(
        controller.getTicket({ sessionId }, userId, sid, generation),
      ).rejects.toThrow(ForbiddenException);

      expect(tokenServiceMock.generateRealtimeTicket).not.toHaveBeenCalled();
    });

    it("бросает ForbiddenException если пользователь не является участником в Redis", async () => {
      redisMock.get.mockResolvedValue("true");
      redisMock.hget.mockResolvedValue(null);

      await expect(
        controller.getTicket({ sessionId }, userId, sid, generation),
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
