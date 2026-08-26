import { UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
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

  return { guard: new AccessTokenGuard(reflector, tokenService), tokenService };
}

describe("AccessTokenGuard", () => {
  describe("@Public() decorator", () => {
    it("пропускает запрос если endpoint помечен @Public()", () => {
      const { guard } = createGuard({ isPublic: true });
      const context = createExecutionContext({});
      expect(guard.canActivate(context)).toBe(true);
    });

    it("не вызывает verifyAccessToken для @Public() endpoints", () => {
      const { guard, tokenService } = createGuard({ isPublic: true });
      const context = createExecutionContext({});
      guard.canActivate(context);
      expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
    });
  });

  describe("отсутствует token", () => {
    it("бросает UnauthorizedException если заголовок отсутствует", () => {
      const { guard } = createGuard();
      const context = createExecutionContext({});
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it("содержит сообщение 'Missing access token'", () => {
      const { guard } = createGuard();
      const context = createExecutionContext({});
      try {
        guard.canActivate(context);
      } catch (e) {
        expect((e as UnauthorizedException).message).toBe(
          "Missing access token",
        );
      }
    });

    it("бросает ошибку если заголовок без Bearer префикса", () => {
      const { guard } = createGuard();
      const context = createExecutionContext({
        authorization: "Token some-token",
      });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it("бросает ошибку если Bearer без токена", () => {
      const { guard } = createGuard();
      const context = createExecutionContext({
        authorization: "Bearer ",
      });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe("невалидный token", () => {
    it("бросает UnauthorizedException если verifyAccessToken выбрасывает ошибку", () => {
      const { guard } = createGuard({
        verifyAccessTokenError: new UnauthorizedException("Invalid token"),
      });
      const context = createExecutionContext({
        authorization: "Bearer invalid-token",
      });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe("просроченный token", () => {
    it("бросает UnauthorizedException для просроченного токена", () => {
      const { guard } = createGuard({
        verifyAccessTokenError: new UnauthorizedException("Invalid token"),
      });
      const context = createExecutionContext({
        authorization: "Bearer expired-token",
      });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe("неверный typ (refresh вместо access)", () => {
    it("бросает UnauthorizedException для refresh token", () => {
      const { guard } = createGuard({
        verifyAccessTokenError: new UnauthorizedException("Invalid token type"),
      });
      const context = createExecutionContext({
        authorization: "Bearer refresh-token",
      });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe("валидный access token", () => {
    it("возвращает true", () => {
      const { guard } = createGuard();
      const context = createExecutionContext({
        authorization: "Bearer valid-access-token",
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it("добавляет payload в request.user", () => {
      const { guard } = createGuard();
      const context = createExecutionContext({
        authorization: "Bearer valid-access-token",
      });
      guard.canActivate(context);
      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual(VALID_PAYLOAD);
    });

    it("вызывает verifyAccessToken с токеном", () => {
      const { guard, tokenService } = createGuard();
      const context = createExecutionContext({
        authorization: "Bearer valid-access-token",
      });
      guard.canActivate(context);
      expect(tokenService.verifyAccessToken).toHaveBeenCalledWith(
        "valid-access-token",
      );
    });
  });
});
