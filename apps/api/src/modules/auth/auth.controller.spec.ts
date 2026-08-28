import { HttpStatus, UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { AuthController } from "./auth.controller";
import type { AuthService } from "./auth.service";
import { AuthThrottlerGuard } from "./guards/auth-throttler.guard";

const DTO = {
  email: "user@example.com",
  password: "Str0ngPassw0rd!123",
};

const AUTH_RESULT = {
  accessToken: "raw.access.token",
  refreshToken: "raw.refresh.token",
};

function createConfigService(secure: boolean): ConfigService {
  const defaults: Record<string, unknown> = {
    "cookie.secure": secure,
    "cookie.refreshTokenName": "refresh_token",
    "jwt.refreshExpiresIn": "7d",
  };
  return {
    get: jest.fn().mockImplementation((key: string) => defaults[key]),
  } as unknown as ConfigService;
}

describe("AuthController", () => {
  let registerMock: jest.Mock;
  let loginMock: jest.Mock;
  let logoutMock: jest.Mock;
  let logoutAllMock: jest.Mock;
  let changePasswordMock: jest.Mock;
  let refreshMock: jest.Mock;
  let cookieMock: jest.Mock;
  let clearCookieMock: jest.Mock;
  let statusMock: jest.Mock;
  let response: Response;

  beforeEach(() => {
    registerMock = jest.fn().mockResolvedValue(AUTH_RESULT);
    loginMock = jest.fn().mockResolvedValue(AUTH_RESULT);
    logoutMock = jest.fn().mockResolvedValue(undefined);
    logoutAllMock = jest.fn().mockResolvedValue(undefined);
    changePasswordMock = jest.fn().mockResolvedValue(undefined);
    refreshMock = jest.fn().mockResolvedValue(AUTH_RESULT);
    cookieMock = jest.fn();
    clearCookieMock = jest.fn();
    statusMock = jest.fn();
    response = {
      cookie: cookieMock,
      clearCookie: clearCookieMock,
      status: statusMock,
    } as unknown as Response;
  });

  function createController(cookieSecure = false): AuthController {
    return new AuthController(
      {
        register: registerMock,
        login: loginMock,
        logout: logoutMock,
        logoutAll: logoutAllMock,
        changePassword: changePasswordMock,
        refresh: refreshMock,
      } as unknown as AuthService,
      createConfigService(cookieSecure),
    );
  }

  function createRequest(cookies?: Record<string, string>): Request {
    return { cookies } as unknown as Request;
  }

  function createRequestWithUser(user: { sub: string }): Request {
    return { user } as unknown as Request;
  }

  describe("register response (§4, §45 SPEC.md)", () => {
    it("возвращает 201 и ТОЛЬКО accessToken в JSON", async () => {
      const body = await createController().register(DTO, response);

      expect(registerMock).toHaveBeenCalledWith(DTO);
      expect(statusMock).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(body).toEqual({ accessToken: "raw.access.token" });
      expect(Object.keys(body)).toEqual(["accessToken"]);
    });

    it("refresh token отсутствует в теле ответа (§45)", async () => {
      const body = await createController().register(DTO, response);

      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain("raw.refresh.token");
      expect(serialized).not.toContain(DTO.password);
    });
  });

  describe("register refresh cookie (§25–28 SPEC.md)", () => {
    it("ставит refresh_token cookie HttpOnly, SameSite=Lax, Path, Max-Age из JWT_REFRESH_EXPIRATION", async () => {
      await createController(false).register(DTO, response);

      expect(cookieMock).toHaveBeenCalledTimes(1);
      const [name, value, options] = cookieMock.mock.calls[0];

      expect(name).toBe("refresh_token");
      expect(value).toBe("raw.refresh.token");
      expect(options).toEqual({
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/api/v1/auth",
        maxAge: 604_800_000,
      });
    });

    it("Secure=true при cookie.secure=true (§27)", async () => {
      await createController(true).register(DTO, response);

      expect(cookieMock.mock.calls[0][2]).toMatchObject({ secure: true });
    });
  });

  describe("login response (§58 SPEC.md)", () => {
    it("вызывает сервис и возвращает ТОЛЬКО accessToken в JSON", async () => {
      const body = await createController().login(DTO, response);

      expect(loginMock).toHaveBeenCalledWith(DTO);
      expect(body).toEqual({ accessToken: "raw.access.token" });
      expect(Object.keys(body)).toEqual(["accessToken"]);
    });

    it("refresh token отсутствует в теле ответа (§45)", async () => {
      const body = await createController().login(DTO, response);

      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain("raw.refresh.token");
      expect(serialized).not.toContain(DTO.password);
    });

    it("маршрут объявлен с @HttpCode(200) (§58)", () => {
      const httpCode = Reflect.getMetadata(
        "__httpCode__",
        AuthController.prototype.login,
      );

      expect(httpCode).toBe(HttpStatus.OK);
    });

    it("на маршруте применён AuthThrottlerGuard (§41, §58)", () => {
      const guards = Reflect.getMetadata(
        "__guards__",
        AuthController.prototype.login,
      ) as unknown[];

      expect(guards).toContain(AuthThrottlerGuard);
    });
  });

  describe("login refresh cookie (§25–28 SPEC.md)", () => {
    it("ставит refresh_token cookie с теми же атрибутами, что и register", async () => {
      await createController(false).login(DTO, response);

      expect(cookieMock).toHaveBeenCalledTimes(1);
      const [name, value, options] = cookieMock.mock.calls[0];

      expect(name).toBe("refresh_token");
      expect(value).toBe("raw.refresh.token");
      expect(options).toEqual({
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/api/v1/auth",
        maxAge: 604_800_000,
      });
    });

    it("Secure=true при cookie.secure=true (§27)", async () => {
      await createController(true).login(DTO, response);

      expect(cookieMock.mock.calls[0][2]).toMatchObject({ secure: true });
    });

    it("статус задаётся декоратором — response.status не вызывается", async () => {
      await createController().login(DTO, response);

      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe("logout (§60 SPEC.md)", () => {
    it("читает refresh cookie, отдаёт сервису и возвращает void без body", async () => {
      const request = createRequest({ refresh_token: "raw.refresh.token" });

      const result = await createController().logout(request, response);

      expect(logoutMock).toHaveBeenCalledWith("raw.refresh.token");
      expect(result).toBeUndefined();
      expect(clearCookieMock).toHaveBeenCalledTimes(1);
    });

    it("@HttpCode(204) объявлен на маршруте (§60)", () => {
      const httpCode = Reflect.getMetadata(
        "__httpCode__",
        AuthController.prototype.logout,
      );

      expect(httpCode).toBe(HttpStatus.NO_CONTENT);
    });

    it("@Public() декоратор присутствует (§64)", () => {
      const metadata = Reflect.getMetadata(
        "isPublic",
        AuthController.prototype.logout,
      );

      expect(metadata).toBe(true);
    });

    it("clearCookie с теми же атрибутами §25–28, кроме Max-Age", async () => {
      const request = createRequest({ refresh_token: "raw.refresh.token" });

      await createController(false).logout(request, response);

      expect(clearCookieMock.mock.calls[0]).toEqual([
        "refresh_token",
        {
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          path: "/api/v1/auth",
        },
      ]);
    });

    it("clearCookie Secure=true при cookie.secure=true (§27)", async () => {
      const request = createRequest({ refresh_token: "raw.refresh.token" });

      await createController(true).logout(request, response);

      expect(clearCookieMock.mock.calls[0][1]).toMatchObject({ secure: true });
    });

    it("401 при отказе: cookie всё равно очищается, ошибка пробрасывается (§60)", async () => {
      logoutMock.mockRejectedValue(
        new UnauthorizedException("Invalid credentials"),
      );
      const request = createRequest({ refresh_token: "tampered" });

      await expect(
        createController().logout(request, response),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(clearCookieMock).toHaveBeenCalledTimes(1);
    });

    it("500 при ошибке Redis: cookie НЕ сбрасывается (§60)", async () => {
      logoutMock.mockRejectedValue(new Error("redis down"));
      const request = createRequest({ refresh_token: "raw.refresh.token" });

      await expect(
        createController().logout(request, response),
      ).rejects.toBeInstanceOf(Error);
      expect(clearCookieMock).not.toHaveBeenCalled();
    });

    it("без cookie: сервис вызывается с undefined, 401 → clearCookie присутствует", async () => {
      logoutMock.mockRejectedValue(
        new UnauthorizedException("Invalid credentials"),
      );
      const request = createRequest(undefined);

      await expect(
        createController().logout(request, response),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(logoutMock).toHaveBeenCalledWith(undefined);
      expect(clearCookieMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("logoutAll (§66 SPEC.md)", () => {
    it("передаёт request.user.sub сервису и очищает refresh cookie", async () => {
      const request = createRequestWithUser({ sub: "user-uuid" });

      const result = await createController().logoutAll(request, response);

      expect(logoutAllMock).toHaveBeenCalledTimes(1);
      expect(logoutAllMock).toHaveBeenCalledWith("user-uuid");
      expect(result).toBeUndefined();
      expect(clearCookieMock).toHaveBeenCalledTimes(1);
    });

    it("@HttpCode(204) объявлен на маршруте (§66)", () => {
      const httpCode = Reflect.getMetadata(
        "__httpCode__",
        AuthController.prototype.logoutAll,
      );

      expect(httpCode).toBe(HttpStatus.NO_CONTENT);
    });

    it("НЕ помечен @Public() — защищён глобальным AccessTokenGuard (§66)", () => {
      const metadata = Reflect.getMetadata(
        "isPublic",
        AuthController.prototype.logoutAll,
      );

      expect(metadata).toBeUndefined();
    });

    it("clearCookie с атрибутами §25–28 (кроме Max-Age)", async () => {
      const request = createRequestWithUser({ sub: "user-uuid" });

      await createController(false).logoutAll(request, response);

      expect(clearCookieMock.mock.calls[0]).toEqual([
        "refresh_token",
        {
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          path: "/api/v1/auth",
        },
      ]);
    });

    it("Redis недоступен: cookie НЕ сбрасывается, ошибка пробрасывается (§66)", async () => {
      logoutAllMock.mockRejectedValue(new Error("redis down"));
      const request = createRequestWithUser({ sub: "user-uuid" });

      await expect(
        createController().logoutAll(request, response),
      ).rejects.toBeInstanceOf(Error);
      expect(clearCookieMock).not.toHaveBeenCalled();
    });
  });

  describe("changePassword (§67 SPEC.md)", () => {
    const CHANGE_PASSWORD_DTO = {
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword123!",
    };

    it("передаёт request.user.sub и dto сервису, очищает refresh cookie, возвращает void", async () => {
      const request = createRequestWithUser({ sub: "user-uuid" });

      const result = await createController().changePassword(
        request,
        CHANGE_PASSWORD_DTO,
        response,
      );

      expect(changePasswordMock).toHaveBeenCalledTimes(1);
      expect(changePasswordMock).toHaveBeenCalledWith(
        "user-uuid",
        CHANGE_PASSWORD_DTO,
      );
      expect(result).toBeUndefined();
      expect(clearCookieMock).toHaveBeenCalledTimes(1);
    });

    it("@HttpCode(204) объявлен на маршруте (§67)", () => {
      const httpCode = Reflect.getMetadata(
        "__httpCode__",
        AuthController.prototype.changePassword,
      );

      expect(httpCode).toBe(HttpStatus.NO_CONTENT);
    });

    it("НЕ помечен @Public() — защищён глобальным AccessTokenGuard (§67)", () => {
      const metadata = Reflect.getMetadata(
        "isPublic",
        AuthController.prototype.changePassword,
      );

      expect(metadata).toBeUndefined();
    });

    it("clearCookie с атрибутами §25–28 (кроме Max-Age)", async () => {
      const request = createRequestWithUser({ sub: "user-uuid" });

      await createController(false).changePassword(
        request,
        CHANGE_PASSWORD_DTO,
        response,
      );

      expect(clearCookieMock.mock.calls[0]).toEqual([
        "refresh_token",
        {
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          path: "/api/v1/auth",
        },
      ]);
    });

    it("401 при неверном пароле: cookie НЕ сбрасывается, ошибка пробрасывается (§67)", async () => {
      changePasswordMock.mockRejectedValue(
        new UnauthorizedException("Неверные учётные данные"),
      );
      const request = createRequestWithUser({ sub: "user-uuid" });

      await expect(
        createController().changePassword(
          request,
          CHANGE_PASSWORD_DTO,
          response,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(clearCookieMock).not.toHaveBeenCalled();
    });

    it("Redis недоступен: cookie НЕ сбрасывается, ошибка пробрасывается (§67)", async () => {
      changePasswordMock.mockRejectedValue(new Error("redis down"));
      const request = createRequestWithUser({ sub: "user-uuid" });

      await expect(
        createController().changePassword(
          request,
          CHANGE_PASSWORD_DTO,
          response,
        ),
      ).rejects.toBeInstanceOf(Error);
      expect(clearCookieMock).not.toHaveBeenCalled();
    });
  });

  describe("refresh (§65 SPEC.md)", () => {
    it("возвращает 200 и ТОЛЬКО accessToken в JSON", async () => {
      const request = createRequest({ refresh_token: "raw.refresh.token" });

      const body = await createController().refresh(request, response);

      expect(refreshMock).toHaveBeenCalledWith("raw.refresh.token");
      expect(body).toEqual({ accessToken: "raw.access.token" });
      expect(Object.keys(body)).toEqual(["accessToken"]);
    });

    it("refresh token отсутствует в теле ответа (§45)", async () => {
      const request = createRequest({ refresh_token: "raw.refresh.token" });

      const body = await createController().refresh(request, response);

      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain("raw.refresh.token");
    });

    it("ставит refresh_token cookie с атрибутами §25–28", async () => {
      const request = createRequest({ refresh_token: "raw.refresh.token" });

      await createController(false).refresh(request, response);

      expect(cookieMock).toHaveBeenCalledTimes(1);
      const [name, value, options] = cookieMock.mock.calls[0];

      expect(name).toBe("refresh_token");
      expect(value).toBe("raw.refresh.token");
      expect(options).toEqual({
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/api/v1/auth",
        maxAge: 604_800_000,
      });
    });

    it("Secure=true при cookie.secure=true (§27)", async () => {
      const request = createRequest({ refresh_token: "raw.refresh.token" });

      await createController(true).refresh(request, response);

      expect(cookieMock.mock.calls[0][2]).toMatchObject({ secure: true });
    });

    it("@HttpCode(200) объявлен на маршруте (§65)", () => {
      const httpCode = Reflect.getMetadata(
        "__httpCode__",
        AuthController.prototype.refresh,
      );

      expect(httpCode).toBe(HttpStatus.OK);
    });

    it("@Public() декоратор присутствует (§64)", () => {
      const metadata = Reflect.getMetadata(
        "isPublic",
        AuthController.prototype.refresh,
      );

      expect(metadata).toBe(true);
    });

    it("на маршруте применён AuthThrottlerGuard (§41)", () => {
      const guards = Reflect.getMetadata(
        "__guards__",
        AuthController.prototype.refresh,
      ) as unknown[];

      expect(guards).toContain(AuthThrottlerGuard);
    });

    it("401 при отказе: cookie очищается, ошибка пробрасывается (§65)", async () => {
      refreshMock.mockRejectedValue(
        new UnauthorizedException("Invalid credentials"),
      );
      const request = createRequest({ refresh_token: "tampered" });

      await expect(
        createController().refresh(request, response),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(clearCookieMock).toHaveBeenCalledTimes(1);
    });

    it("500 при ошибке Redis: cookie НЕ сбрасывается (§60)", async () => {
      refreshMock.mockRejectedValue(new Error("redis down"));
      const request = createRequest({ refresh_token: "raw.refresh.token" });

      await expect(
        createController().refresh(request, response),
      ).rejects.toBeInstanceOf(Error);
      expect(clearCookieMock).not.toHaveBeenCalled();
    });

    it("без cookie: сервис вызывается с undefined, 401 → clearCookie", async () => {
      refreshMock.mockRejectedValue(
        new UnauthorizedException("Invalid credentials"),
      );
      const request = createRequest(undefined);

      await expect(
        createController().refresh(request, response),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshMock).toHaveBeenCalledWith(undefined);
      expect(clearCookieMock).toHaveBeenCalledTimes(1);
    });
  });
});
