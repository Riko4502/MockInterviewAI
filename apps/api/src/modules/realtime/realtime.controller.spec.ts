import { UnauthorizedException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { AuthThrottlerGuard } from "../auth/guards/auth-throttler.guard";
import { TokenService } from "../auth/services/token.service";
import { LivekitService } from "./livekit.service";
import { RealtimeController } from "./realtime.controller";

describe("RealtimeController", () => {
  let controller: RealtimeController;
  let tokenService: jest.Mocked<Partial<TokenService>>;
  let livekitService: jest.Mocked<Partial<LivekitService>>;

  beforeEach(async () => {
    tokenService = {
      generateRealtimeTicket: jest.fn().mockReturnValue("signed-ticket-jwt"),
    };

    livekitService = {
      generateMediaToken: jest.fn().mockResolvedValue({
        token: "livekit-token",
        serverUrl: "wss://livekit.example.com",
        roomName: "room-123",
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RealtimeController],
      providers: [
        { provide: TokenService, useValue: tokenService },
        { provide: LivekitService, useValue: livekitService },
      ],
    })
      .overrideGuard(AuthThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RealtimeController>(RealtimeController);
  });

  describe("getTicket", () => {
    const validSessionId = "00000000-0000-0000-0000-000000000001";
    const userId = "00000000-0000-0000-0000-000000000002";
    const sid = "00000000-0000-0000-0000-000000000003";

    it("should issue ticket when generation is provided", async () => {
      const result = await controller.getTicket(
        { sessionId: validSessionId },
        userId,
        sid,
        1,
      );

      expect(result).toEqual({ ticket: "signed-ticket-jwt" });
      expect(tokenService.generateRealtimeTicket).toHaveBeenCalledWith(
        userId,
        sid,
        validSessionId,
        1,
      );
    });

    it("should throw UnauthorizedException when generation claim is missing", async () => {
      await expect(
        controller.getTicket(
          { sessionId: validSessionId },
          userId,
          sid,
          undefined,
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(tokenService.generateRealtimeTicket).not.toHaveBeenCalled();
    });
  });

  describe("getMediaToken", () => {
    const validSessionId = "00000000-0000-0000-0000-000000000001";
    const userId = "00000000-0000-0000-0000-000000000002";

    it("should delegate to livekitService.generateMediaToken", async () => {
      const result = await controller.getMediaToken(
        { sessionId: validSessionId },
        userId,
      );

      expect(result).toEqual({
        token: "livekit-token",
        serverUrl: "wss://livekit.example.com",
        roomName: "room-123",
      });
      expect(livekitService.generateMediaToken).toHaveBeenCalledWith(
        userId,
        validSessionId,
      );
    });
  });
});
