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
  generation: 1,
};

const VALID_SESSION = {
  userId: "user-uuid",
  refreshTokenHash: "hash",
  tokenFamilyId: "family-uuid",
  createdAt: "2026-08-01T12:00:00.000Z",
  lastUsedAt: "2026-08-01T12:00:00.000Z",
  generation: 1,
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
  session?: typeof VALID_SESSION | null;
  getSessionError?: Error;
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
    getSession: jest.fn().mockImplementation(async () => {
      if (options?.getSessionError) {
        throw options.getSessionError;
      }
      if (options?.session !== undefined) {
        return options.session;
      }
      return VALID_SESSION;
    }),
    isSessionActive: jest.fn().mockResolvedValue(true),
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

    it("не вызывает verifyAccessToken и getSession для @Public() endpoints", async () => {
      const { guard, tokenService, authSessionService } = createGuard({
        isPublic: true,
      });
      const context = createExecutionContext({});
      await guard.canActivate(context);
      expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
      expect(authSessionService.getSession).not.toHaveBeenCalled();
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

  describe("live-проверка сессии (A8, CWE-362)", () => {
    it("вызывает getSession с sid из payload", async () => {
      const { guard, authSessionService } = createGuard();
      const context = createExecutionContext({
        authorization: "Bearer valid-access-token",
      });
      await guard.canActivate(context);
      expect(authSessionService.getSession).toHaveBeenCalledWith(
        VALID_PAYLOAD.sid,
      );
    });

    it("возвращает 401 если сессия удалена/отозвана", async () => {
      const { guard, authSessionService } = createGuard();
      (authSessionService.getSession as jest.Mock).mockResolvedValue(null);
      const context = createExecutionContext({
        authorization: "Bearer valid-access-token",
      });
      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException("Session has expired or been revoked"),
      );
    });

    it("возвращает 401 если userId в сессии не совпадает с sub", async () => {
      const { guard, authSessionService } = createGuard();
      (authSessionService.getSession as jest.Mock).mockResolvedValue({
        ...VALID_SESSION,
        userId: "different-user-uuid",
      });
      const context = createExecutionContext({
        authorization: "Bearer valid-access-token",
      });
      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException("Session has expired or been revoked"),
      );
    });

    it("возвращает 401 если generation в токене и сессии не совпадают (§CWE-362)", async () => {
      const { guard, authSessionService } = createGuard();
      (authSessionService.getSession as jest.Mock).mockResolvedValue({
        ...VALID_SESSION,
        generation: 2,
      });
      const context = createExecutionContext({
        authorization: "Bearer valid-access-token",
      });
      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException("Session has expired or been revoked"),
      );
    });

    it("возвращает 401 если в access токене отсутствует generation claim (§CWE-613)", async () => {
      const { guard } = createGuard({
        verifyAccessToken: {
          ...VALID_PAYLOAD,
          generation: undefined,
        },
      });
      const context = createExecutionContext({
        authorization: "Bearer valid-access-token",
      });
      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException("Session has expired or been revoked"),
      );
    });

    it("возвращает 401 если в сессии отсутствует generation (§CWE-613)", async () => {
      const { guard, authSessionService } = createGuard();
      (authSessionService.getSession as jest.Mock).mockResolvedValue({
        ...VALID_SESSION,
        generation: undefined,
      });
      const context = createExecutionContext({
        authorization: "Bearer valid-access-token",
      });
      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException("Session has expired or been revoked"),
      );
    });

    it("пробрасывает исключение Redis (Nest → 500)", async () => {
      const { guard, authSessionService } = createGuard();
      (authSessionService.getSession as jest.Mock).mockRejectedValue(
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
