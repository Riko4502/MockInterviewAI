import { UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthSessionService } from "../../modules/auth/services/auth-session.service";
import type { TokenPayload } from "../../modules/auth/services/token.service";
import { TokenService } from "../../modules/auth/services/token.service";
import { AccessTokenGuard } from "./access-token.guard";

const VALID_PAYLOAD: TokenPayload = {
  sub: "user-uuid",
  sid: "session-uuid",
  typ: "access",
  iss: "mock-interview-ai",
  aud: "api",
  iat: 1234567890,
  exp: 9999999999,
  jti: "token-uuid",
};

function createExecutionContext(headers: Record<string, string | undefined>) {
  const request = { headers, user: undefined };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    // biome-ignore lint/suspicious/noExplicitAny: mock ExecutionContext for testing
  } as any;
}

function createGuard(options?: {
  isPublic?: boolean;
  verifyAccessToken?: TokenPayload;
  verifyAccessTokenError?: Error;
  isSessionActiveError?: Error;
}) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(options?.isPublic ?? false),
  } as unknown as Reflector;

  const tokenService = {
    verifyAccessToken: jest.fn().mockImplementation(() => {
      if (options?.verifyAccessTokenError) {
        throw options.verifyAccessTokenError;
      }
      return options?.verifyAccessToken ?? VALID_PAYLOAD;
    }),
  } as unknown as TokenService;

  const authSessionService = {
    isSessionActive: jest.fn().mockImplementation(async () => {
      if (options?.isSessionActiveError) {
        throw options.isSessionActiveError;
      }
      return true;
    }),
  } as unknown as AuthSessionService;

  return {
    guard: new AccessTokenGuard(reflector, tokenService, authSessionService),
    tokenService,
    authSessionService,
  };
}

describe("AccessTokenGuard", () => {
  describe("@Public() decorator", () => {
    it("пропускает запрос если endpoint помечен @Public()", async () => {
      const { guard } = createGuard({ isPublic: true });
      const context = createExecutionContext({});
      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it("не вызывает verifyAccessToken и isSessionActive для @Public() endpoints", async () => {
      const { guard, tokenService, authSessionService } = createGuard({
        isPublic: true,
      });
      const context = createExecutionContext({});
      await guard.canActivate(context);
      expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
      expect(authSessionService.isSessionActive).not.toHaveBeenCalled();
    });
  });

  describe("отсутствует token", () => {
    it("бросает UnauthorizedException если заголовок отсутствует", async () => {
      const { guard } = createGuard();
      const context = createExecutionContext({});
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("содержит сообщение 'Missing access token'", async () => {
      const { guard } = createGuard();
      const context = createExecutionContext({});
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Missing access token",
      );
    });

    it("бросает ошибку если заголовок без Bearer префикса", async () => {
      const { guard } = createGuard();
      const context = createExecutionContext({
        authorization: "Token some-token",
      });
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("бросает ошибку если Bearer без токена", async () => {
      const { guard } = createGuard();
      const context = createExecutionContext({
        authorization: "Bearer ",
      });
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("Bearer-парсер (§64, A8)", () => {
    it("извлекает токен из 'Bearer <token>' с одним пробелом", async () => {
      const { guard, tokenService } = createGuard();
      const context = createExecutionContext({
        authorization: "Bearer valid-access-token",
      });
      await guard.canActivate(context);
      expect(tokenService.verifyAccessToken).toHaveBeenCalledWith(
        "valid-access-token",
      );
    });

    it("извлекает токен с двойным пробелом после Bearer", async () => {
      const { guard, tokenService } = createGuard();
      const context = createExecutionContext({
        authorization: "Bearer  valid-access-token",
      });
      await guard.canActivate(context);
      expect(tokenService.verifyAccessToken).toHaveBeenCalledWith(
        "valid-access-token",
      );
    });
  });

  describe("невалидный token", () => {
    it("бросает UnauthorizedException если verifyAccessToken выбрасывает ошибку", async () => {
      const { guard } = createGuard({
        verifyAccessTokenError: new UnauthorizedException("Invalid token"),
      });
      const context = createExecutionContext({
        authorization: "Bearer invalid-token",
      });
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("просроченный token", () => {
    it("бросает UnauthorizedException для просроченного токена", async () => {
      const { guard } = createGuard({
        verifyAccessTokenError: new UnauthorizedException("Invalid token"),
      });
      const context = createExecutionContext({
        authorization: "Bearer expired-token",
      });
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("неверный typ (refresh вместо access)", () => {
    it("бросает UnauthorizedException для refresh token", async () => {
      const { guard } = createGuard({
        verifyAccessTokenError: new UnauthorizedException("Invalid token type"),
      });
      const context = createExecutionContext({
        authorization: "Bearer refresh-token",
      });
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("live-проверка сессии (A8)", () => {
    it("вызывает isSessionActive с sid из payload", async () => {
      const { guard, authSessionService } = createGuard();
      const context = createExecutionContext({
        authorization: "Bearer valid-access-token",
      });
      await guard.canActivate(context);
      expect(authSessionService.isSessionActive).toHaveBeenCalledWith(
        VALID_PAYLOAD.sid,
      );
    });

    it("возвращает 401 если сессия удалена/отозвана", async () => {
      const { guard, authSessionService } = createGuard();
      (authSessionService.isSessionActive as jest.Mock).mockResolvedValue(
        false,
      );
      const context = createExecutionContext({
        authorization: "Bearer valid-access-token",
      });
      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException("Session has expired or been revoked"),
      );
    });

    it("пробрасывает исключение Redis (Nest → 500)", async () => {
      const { guard, authSessionService } = createGuard();
      (authSessionService.isSessionActive as jest.Mock).mockRejectedValue(
        new Error("redis down"),
      );
      const context = createExecutionContext({
        authorization: "Bearer valid-access-token",
      });
      await expect(guard.canActivate(context)).rejects.toThrow("redis down");
    });
  });

  describe("валидный access token", () => {
    it("возвращает true", async () => {
      const { guard } = createGuard();
      const context = createExecutionContext({
        authorization: "Bearer valid-access-token",
      });
      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it("добавляет payload в request.user", async () => {
      const { guard } = createGuard();
      const context = createExecutionContext({
        authorization: "Bearer valid-access-token",
      });
      await guard.canActivate(context);
      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual(VALID_PAYLOAD);
    });

    it("вызывает verifyAccessToken с токеном", async () => {
      const { guard, tokenService } = createGuard();
      const context = createExecutionContext({
        authorization: "Bearer valid-access-token",
      });
      await guard.canActivate(context);
      expect(tokenService.verifyAccessToken).toHaveBeenCalledWith(
        "valid-access-token",
      );
    });
  });
});
