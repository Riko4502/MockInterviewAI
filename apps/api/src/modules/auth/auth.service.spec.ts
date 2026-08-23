import { randomUUID } from "node:crypto";
import {
  ConflictException,
  InternalServerErrorException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import argon2 from "argon2";
import type { PrismaService } from "../../prisma/prisma.service";
import type { UsersService } from "../users/users.service";
import { AuthService } from "./auth.service";
import type { AuthSessionService } from "./services/auth-session.service";
import type { TokenService } from "./services/token.service";

jest.mock("node:crypto", () => ({
  ...jest.requireActual("node:crypto"),
  randomUUID: jest.fn(),
}));

jest.mock("argon2", () => ({
  __esModule: true,
  default: {
    hash: jest.fn(),
    argon2id: 2,
  },
}));

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TOKEN_FAMILY_ID = "22222222-2222-4222-8222-222222222222";

const DTO = {
  email: "user@example.com",
  password: "Str0ngPassw0rd!123",
};

const USER = { id: "user-1", email: DTO.email };

type LoggerAccessor = {
  logger: {
    error: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
  };
};

function createConfigService(): ConfigService {
  const defaults: Record<string, unknown> = {
    "argon2.memoryCost": 19456,
    "argon2.timeCost": 2,
    "argon2.parallelism": 1,
  };
  return {
    get: jest.fn().mockImplementation((key: string) => defaults[key]),
  } as unknown as ConfigService;
}

describe("AuthService", () => {
  let service: AuthService;
  let findByEmail: jest.Mock;
  let createUser: jest.Mock;
  let generateAccessToken: jest.Mock;
  let generateRefreshToken: jest.Mock;
  let hashRefreshToken: jest.Mock;
  let createSession: jest.Mock;
  let deleteUser: jest.Mock;
  let loggerErrorSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;
  let loggerDebugSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    findByEmail = jest.fn().mockResolvedValue(null);
    createUser = jest.fn().mockResolvedValue(USER);
    generateAccessToken = jest.fn().mockReturnValue("raw.access.token");
    generateRefreshToken = jest.fn().mockReturnValue("raw.refresh.token");
    hashRefreshToken = jest.fn().mockReturnValue("stored.hmac.hash");
    createSession = jest.fn().mockResolvedValue(undefined);
    deleteUser = jest.fn().mockResolvedValue(undefined);
    (argon2.hash as jest.Mock).mockResolvedValue("$argon2id$test-hash");

    (randomUUID as unknown as jest.Mock)
      .mockReturnValueOnce(SESSION_ID)
      .mockReturnValueOnce(TOKEN_FAMILY_ID);

    service = new AuthService(
      { findByEmail, create: createUser } as unknown as UsersService,
      {
        generateAccessToken,
        generateRefreshToken,
        hashRefreshToken,
      } as unknown as TokenService,
      { createSession } as unknown as AuthSessionService,
      { user: { delete: deleteUser } } as unknown as PrismaService,
      createConfigService(),
    );

    loggerErrorSpy = jest
      .spyOn((service as unknown as LoggerAccessor).logger, "error")
      .mockImplementation(() => undefined);
    loggerWarnSpy = jest
      .spyOn((service as unknown as LoggerAccessor).logger, "warn")
      .mockImplementation(() => undefined);
    loggerDebugSpy = jest
      .spyOn((service as unknown as LoggerAccessor).logger, "debug")
      .mockImplementation(() => undefined);
  });

  describe("успешная регистрация", () => {
    it("хеширует пароль, создаёт User и session, возвращает токены", async () => {
      const result = await service.register(DTO);

      expect(findByEmail).toHaveBeenCalledWith(DTO.email);
      expect(argon2.hash).toHaveBeenCalledWith(DTO.password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
      expect(createUser).toHaveBeenCalledWith({
        email: DTO.email,
        passwordHash: "$argon2id$test-hash",
      });
      expect(generateAccessToken).toHaveBeenCalledWith(USER.id, SESSION_ID);
      expect(generateRefreshToken).toHaveBeenCalledWith(USER.id, SESSION_ID);
      expect(hashRefreshToken).toHaveBeenCalledWith("raw.refresh.token");
      expect(createSession).toHaveBeenCalledWith(
        SESSION_ID,
        USER.id,
        "stored.hmac.hash",
        TOKEN_FAMILY_ID,
      );
      expect(result).toEqual({
        accessToken: "raw.access.token",
        refreshToken: "raw.refresh.token",
      });
    });

    it("не выполняет компенсацию (user не удаляется)", async () => {
      await service.register(DTO);

      expect(deleteUser).not.toHaveBeenCalled();
    });
  });

  describe("existing email", () => {
    it("выбрасывает 409 Conflict, downstream не вызывается", async () => {
      findByEmail.mockResolvedValue(USER);

      await expect(service.register(DTO)).rejects.toThrow(ConflictException);
      await expect(service.register(DTO)).rejects.toMatchObject({
        message: "Email already registered",
      });
      expect(createUser).not.toHaveBeenCalled();
      expect(argon2.hash).not.toHaveBeenCalled();
      expect(generateAccessToken).not.toHaveBeenCalled();
      expect(generateRefreshToken).not.toHaveBeenCalled();
      expect(createSession).not.toHaveBeenCalled();
      expect(deleteUser).not.toHaveBeenCalled();
    });
  });

  describe("Redis unavailable (§48 компенсация)", () => {
    it("удаляет созданного user и выбрасывает 500", async () => {
      createSession.mockRejectedValue(
        new Error("connect ECONNREFUSED 127.0.0.1:6379"),
      );

      await expect(service.register(DTO)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
      expect(deleteUser).toHaveBeenCalledTimes(1);
      expect(deleteUser).toHaveBeenCalledWith({ where: { id: USER.id } });
    });

    it("ошибка Redis не раскрывается в ответе, access token не возвращается", async () => {
      createSession.mockRejectedValue(
        new Error("connect ECONNREFUSED 127.0.0.1:6379"),
      );

      const error = await service.register(DTO).catch((e) => e);

      expect(error.getStatus()).toBe(500);
      expect(JSON.stringify(error.getResponse())).not.toContain("ECONNREFUSED");
      expect(JSON.stringify(error.getResponse())).not.toContain("127.0.0.1");
      expect(error.getResponse()).not.toHaveProperty("accessToken");
    });

    it("ошибка компенсации проглатывается — основной ответ остаётся 500", async () => {
      createSession.mockRejectedValue(
        new Error("connect ECONNREFUSED 127.0.0.1:6379"),
      );
      deleteUser.mockRejectedValue(new Error("delete failed"));

      await expect(service.register(DTO)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe("security (§26–34, §45–46 SPEC.md)", () => {
    it("password и passwordHash не попадают в логи (§46)", async () => {
      await service.register(DTO);
      createSession.mockRejectedValue(new Error("redis down"));
      await service.register(DTO).catch(() => undefined);

      const logged = JSON.stringify([
        loggerErrorSpy.mock.calls,
        loggerWarnSpy.mock.calls,
        loggerDebugSpy.mock.calls,
      ]);

      expect(logged).not.toContain(DTO.password);
      expect(logged).not.toContain("$argon2id$test-hash");
    });

    it("raw токены и пароль не попадают в логи при компенсации (§46)", async () => {
      createSession.mockRejectedValue(new Error("redis down"));
      await service.register(DTO).catch(() => undefined);

      const logged = JSON.stringify(loggerErrorSpy.mock.calls);

      expect(logged).not.toContain("raw.refresh.token");
      expect(logged).not.toContain("raw.access.token");
      expect(logged).not.toContain("stored.hmac.hash");
    });

    it("refresh token хранится в Redis только как hash (§17, §30)", async () => {
      await service.register(DTO);

      expect(hashRefreshToken).toHaveBeenCalledWith("raw.refresh.token");
      expect(createSession).toHaveBeenCalledWith(
        SESSION_ID,
        USER.id,
        "stored.hmac.hash",
        TOKEN_FAMILY_ID,
      );
    });

    it("access token не сохраняется в Redis session (§45)", async () => {
      await service.register(DTO);

      const storedArgs = JSON.stringify(createSession.mock.calls[0]);

      expect(storedArgs).toContain("stored.hmac.hash");
      expect(storedArgs).not.toContain("raw.access.token");
      expect(storedArgs).not.toContain("raw.refresh.token");
    });

    it("результат register не содержит forbidden данных (§45)", async () => {
      const result = await service.register(DTO);

      expect(Object.keys(result).sort()).toEqual([
        "accessToken",
        "refreshToken",
      ]);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(DTO.password);
      expect(serialized).not.toContain("$argon2id$test-hash");
      expect(serialized).not.toContain("stored.hmac.hash");
    });
  });
});
