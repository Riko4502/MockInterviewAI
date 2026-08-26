import { type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { AuthSessionService } from "../../modules/auth/services/auth-session.service";
import type {
  TokenPayload,
  TokenService,
} from "../../modules/auth/services/token.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

describe("JwtAuthGuard", () => {
  let tokenServiceMock: jest.Mocked<Partial<TokenService>>;
  let authSessionServiceMock: jest.Mocked<Partial<AuthSessionService>>;
  let configServiceMock: jest.Mocked<Partial<ConfigService>>;
  let guard: JwtAuthGuard;

  const validPayload: TokenPayload = {
    sub: "11111111-1111-4111-a111-111111111111",
    sid: "22222222-2222-4222-a222-222222222222",
    typ: "access",
    iss: "mock-interview-api",
    aud: "mock-interview-client",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
    jti: "33333333-3333-4333-a333-333333333333",
  };

  beforeEach(() => {
    tokenServiceMock = {
      verifyAccessToken: jest.fn().mockReturnValue(validPayload),
    };
    authSessionServiceMock = {
      getSession: jest.fn().mockResolvedValue({
        userId: validPayload.sub,
        refreshTokenHash: "somehash",
        tokenFamilyId: "family-id",
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      }),
    };
    configServiceMock = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === "cookie.accessTokenName") return "access_token";
        return null;
      }),
    };

    guard = new JwtAuthGuard(
      tokenServiceMock as TokenService,
      authSessionServiceMock as AuthSessionService,
      configServiceMock as ConfigService,
    );
  });

  function createMockExecutionContext(
    request: Record<string, unknown>,
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it("успешно пропускает запрос с токеном в HttpOnly cookies", async () => {
    const request: Record<string, unknown> = {
      cookies: { access_token: "valid.jwt.cookie" },
      headers: {},
    };
    const context = createMockExecutionContext(request);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(tokenServiceMock.verifyAccessToken).toHaveBeenCalledWith(
      "valid.jwt.cookie",
    );
    expect(authSessionServiceMock.getSession).toHaveBeenCalledWith(
      validPayload.sid,
    );
    expect(request.user).toEqual(validPayload);
  });

  it("успешно пропускает запрос с токеном в заголовке Authorization: Bearer", async () => {
    const request: Record<string, unknown> = {
      cookies: {},
      headers: { authorization: "Bearer valid.jwt.bearer" },
    };
    const context = createMockExecutionContext(request);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(tokenServiceMock.verifyAccessToken).toHaveBeenCalledWith(
      "valid.jwt.bearer",
    );
    expect(request.user).toEqual(validPayload);
  });

  it("выбрасывает 401 Unauthorized если токен отсутствует", async () => {
    const request: Record<string, unknown> = {
      cookies: {},
      headers: {},
    };
    const context = createMockExecutionContext(request);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("выбрасывает 401 Unauthorized если сессия в Redis отозвана/не найдена", async () => {
    authSessionServiceMock.getSession = jest.fn().mockResolvedValue(null);
    const request: Record<string, unknown> = {
      cookies: { access_token: "valid.jwt.cookie" },
      headers: {},
    };
    const context = createMockExecutionContext(request);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException("Session has expired or been revoked"),
    );
  });
});
