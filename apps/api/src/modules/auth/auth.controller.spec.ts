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
  let cookieMock: jest.Mock;
  let clearCookieMock: jest.Mock;
  let statusMock: jest.Mock;
  let response: Response;

  beforeEach(() => {
    registerMock = jest.fn().mockResolvedValue(AUTH_RESULT);
    loginMock = jest.fn().mockResolvedValue(AUTH_RESULT);
    logoutMock = jest.fn().mockResolvedValue(undefined);
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
      } as unknown as AuthService,
      createConfigService(cookieSecure),
    );
  }

  function createRequest(cookies?: Record<string, string>): Request {
    return { cookies } as unknown as Request;
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
        maxAge: 604_800,
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
        maxAge: 604_800,
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
});
