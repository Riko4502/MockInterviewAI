import { HttpStatus } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { AuthController } from "./auth.controller";
import type { AuthService } from "./auth.service";

const DTO = {
  email: "user@example.com",
  password: "Str0ngPassw0rd!123",
};

const REGISTER_RESULT = {
  accessToken: "raw.access.token",
  refreshToken: "raw.refresh.token",
};

function createConfigService(secure: boolean): ConfigService {
  return {
    get: jest
      .fn()
      .mockImplementation((key: string) =>
        key === "cookie.refreshTokenName" ? "refresh_token" : secure,
      ),
  } as unknown as ConfigService;
}

describe("AuthController", () => {
  let registerMock: jest.Mock;
  let cookieMock: jest.Mock;
  let statusMock: jest.Mock;
  let response: Response;

  beforeEach(() => {
    registerMock = jest.fn().mockResolvedValue(REGISTER_RESULT);
    cookieMock = jest.fn();
    statusMock = jest.fn();
    response = {
      cookie: cookieMock,
      status: statusMock,
    } as unknown as Response;
  });

  function createController(cookieSecure = false): AuthController {
    return new AuthController(
      { register: registerMock } as unknown as AuthService,
      createConfigService(cookieSecure),
    );
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

  describe("refresh cookie (§25–28 SPEC.md)", () => {
    it("ставит refresh_token cookie HttpOnly, SameSite=Lax, Path, Max-Age", async () => {
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
        maxAge: 2_592_000,
      });
    });

    it("Secure=true при cookie.secure=true (§27)", async () => {
      await createController(true).register(DTO, response);

      expect(cookieMock.mock.calls[0][2]).toMatchObject({ secure: true });
    });
  });
});
