import { randomUUID } from "node:crypto";
import {
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
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
    verify: jest.fn(),
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
const USER_PASSWORD_HASH = "$argon2id$user-password-hash";

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
  let verifyRefreshToken: jest.Mock;
  let getSession: jest.Mock;
  let revokeSession: jest.Mock;
  let deleteUser: jest.Mock;
  let loggerErrorSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;
  let loggerDebugSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();

    findByEmail = jest.fn().mockResolvedValue(null);
    createUser = jest.fn().mockResolvedValue(USER);
    generateAccessToken = jest.fn().mockReturnValue("raw.access.token");
    generateRefreshToken = jest.fn().mockReturnValue("raw.refresh.token");
    hashRefreshToken = jest.fn().mockReturnValue("stored.hmac.hash");
    createSession = jest.fn().mockResolvedValue(undefined);
    deleteUser = jest.fn().mockResolvedValue(undefined);
    (argon2.hash as jest.Mock).mockResolvedValue("$argon2id$test-hash");
    (argon2.verify as jest.Mock).mockResolvedValue(true);

    verifyRefreshToken = jest.fn().mockReturnValue({
      sub: USER.id,
      sid: SESSION_ID,
      typ: "refresh",
    });
    getSession = jest.fn().mockResolvedValue({
      userId: USER.id,
      refreshTokenHash: "stored.hmac.hash",
      tokenFamilyId: TOKEN_FAMILY_ID,
      createdAt: "2026-08-24T00:00:00.000Z",
      lastUsedAt: "2026-08-24T00:00:00.000Z",
    });
    revokeSession = jest.fn().mockResolvedValue(undefined);

    (randomUUID as unknown as jest.Mock)
      .mockReturnValueOnce(SESSION_ID)
      .mockReturnValueOnce(TOKEN_FAMILY_ID);

    service = new AuthService(
      { findByEmail, create: createUser } as unknown as UsersService,
      {
        generateAccessToken,
        generateRefreshToken,
        hashRefreshToken,
        verifyRefreshToken,
      } as unknown as TokenService,
      {
        createSession,
        getSession,
        revokeSession,
      } as unknown as AuthSessionService,
      { user: { delete: deleteUser } } as unknown as PrismaService,
      createConfigService(),
    );

    await service.onModuleInit();
    jest.clearAllMocks();

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

  describe("login: успешный вход (§58 SPEC.md)", () => {
    it("проверяет пароль против хеша пользователя, создаёт новую session, возвращает токены", async () => {
      findByEmail.mockResolvedValue({
        ...USER,
        passwordHash: USER_PASSWORD_HASH,
      });
      const verify = argon2.verify as jest.Mock;

      const result = await service.login(DTO);

      expect(findByEmail).toHaveBeenCalledWith(DTO.email);
      expect(verify).toHaveBeenCalledTimes(1);
      expect(verify).toHaveBeenCalledWith(USER_PASSWORD_HASH, DTO.password);
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

    it("каждый логин порождает новый sessionId и tokenFamilyId", async () => {
      findByEmail.mockResolvedValue({
        ...USER,
        passwordHash: USER_PASSWORD_HASH,
      });

      await service.login(DTO);

      expect(createSession).toHaveBeenCalledWith(
        SESSION_ID,
        USER.id,
        "stored.hmac.hash",
        TOKEN_FAMILY_ID,
      );
    });

    it("результат login не содержит forbidden данных (§45)", async () => {
      findByEmail.mockResolvedValue({
        ...USER,
        passwordHash: USER_PASSWORD_HASH,
      });
      const result = await service.login(DTO);

      expect(Object.keys(result).sort()).toEqual([
        "accessToken",
        "refreshToken",
      ]);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(DTO.password);
      expect(serialized).not.toContain(USER_PASSWORD_HASH);
      expect(serialized).not.toContain("stored.hmac.hash");
    });
  });

  describe("login: unknown email (§59 account enumeration)", () => {
    it("выполняет dummy argon2-проверку и возвращает generic 401", async () => {
      findByEmail.mockResolvedValue(null);
      const verify = argon2.verify as jest.Mock;
      verify.mockResolvedValue(false);

      const error = await service.login(DTO).catch((e) => e);

      // dummy-проверка: единственный вызов verify — против argon2id-хеша,
      // не совпадающего с хешем реального пользователя
      expect(verify).toHaveBeenCalledTimes(1);
      const [hashedArg] = verify.mock.calls[0];
      expect(hashedArg).toMatch(/^\$argon2id\$/);
      expect(hashedArg).not.toBe(USER_PASSWORD_HASH);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.getStatus()).toBe(401);
      expect(error.getResponse()).toMatchObject({
        message: "Invalid credentials",
      });
      expect(generateAccessToken).not.toHaveBeenCalled();
      expect(generateRefreshToken).not.toHaveBeenCalled();
      expect(createSession).not.toHaveBeenCalled();
    });
  });

  describe("login: неверный пароль (§59)", () => {
    it("возвращает generic 401 с телом, идентичным unknown email (байт-в-байт)", async () => {
      const verify = argon2.verify as jest.Mock;

      findByEmail.mockResolvedValue({
        ...USER,
        passwordHash: USER_PASSWORD_HASH,
      });
      verify.mockResolvedValue(false);
      const wrongPasswordError = await service.login(DTO).catch((e) => e);

      findByEmail.mockResolvedValue(null);
      const unknownEmailError = await service.login(DTO).catch((e) => e);

      expect(wrongPasswordError).toBeInstanceOf(UnauthorizedException);
      expect(wrongPasswordError.getStatus()).toBe(401);
      expect(JSON.stringify(wrongPasswordError.getResponse())).toBe(
        JSON.stringify(unknownEmailError.getResponse()),
      );
      expect(createSession).not.toHaveBeenCalled();
    });
  });

  describe("login: Redis unavailable (§58)", () => {
    beforeEach(() => {
      findByEmail.mockResolvedValue({
        ...USER,
        passwordHash: USER_PASSWORD_HASH,
      });
      createSession.mockRejectedValue(
        new Error("connect ECONNREFUSED 127.0.0.1:6379"),
      );
    });

    it("выбрасывает 500 без внутренних деталей, компенсация не требуется", async () => {
      const error = await service.login(DTO).catch((e) => e);

      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect(error.getStatus()).toBe(500);
      expect(JSON.stringify(error.getResponse())).not.toContain("ECONNREFUSED");
      expect(JSON.stringify(error.getResponse())).not.toContain("127.0.0.1");
      expect(deleteUser).not.toHaveBeenCalled();
    });

    it("password и токены не попадают в логи (§46)", async () => {
      await service.login(DTO).catch(() => undefined);

      const logged = JSON.stringify([
        loggerErrorSpy.mock.calls,
        loggerWarnSpy.mock.calls,
        loggerDebugSpy.mock.calls,
      ]);

      expect(logged).not.toContain(DTO.password);
      expect(logged).not.toContain(USER_PASSWORD_HASH);
      expect(logged).not.toContain("raw.refresh.token");
      expect(logged).not.toContain("raw.access.token");
      expect(logged).not.toContain("stored.hmac.hash");
    });
  });

  describe("logout: успешный выход (§60 SPEC.md)", () => {
    it("верифицирует JWT, сравнивает HMAC-хеш и отзывает session по sid", async () => {
      await service.logout("raw.refresh.token");

      expect(verifyRefreshToken).toHaveBeenCalledWith("raw.refresh.token");
      expect(hashRefreshToken).toHaveBeenCalledWith("raw.refresh.token");
      expect(getSession).toHaveBeenCalledWith(SESSION_ID);
      expect(revokeSession).toHaveBeenCalledTimes(1);
      expect(revokeSession).toHaveBeenCalledWith(SESSION_ID);
    });

    it("отсутствие cookie → generic 401 без обращений к Redis", async () => {
      const error = await service.logout(undefined).catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.getStatus()).toBe(401);
      expect(error.getResponse()).toMatchObject({
        message: "Invalid credentials",
      });
      expect(verifyRefreshToken).not.toHaveBeenCalled();
      expect(getSession).not.toHaveBeenCalled();
      expect(revokeSession).not.toHaveBeenCalled();
    });
  });

  describe("logout: отказ (§60 строгая семантика)", () => {
    it("сессия отсутствует в Redis → 401, session не отзывается", async () => {
      getSession.mockResolvedValue(null);

      const error = await service.logout("raw.refresh.token").catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.getStatus()).toBe(401);
      expect(error.getResponse()).toMatchObject({
        message: "Invalid credentials",
      });
      expect(revokeSession).not.toHaveBeenCalled();
    });

    it("hash mismatch (ротация сессии) → 401, session не отзывается", async () => {
      getSession.mockResolvedValue({
        userId: USER.id,
        refreshTokenHash: "rotated.hmac.hash",
        tokenFamilyId: TOKEN_FAMILY_ID,
        createdAt: "2026-08-24T00:00:00.000Z",
        lastUsedAt: "2026-08-24T00:00:00.000Z",
      });

      const error = await service.logout("old.refresh.token").catch((e) => e);

      expect(hashRefreshToken).toHaveBeenCalledWith("old.refresh.token");
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.getStatus()).toBe(401);
      expect(revokeSession).not.toHaveBeenCalled();
    });

    it("невалидный / просроченный JWT → 401 до обращения к Redis", async () => {
      verifyRefreshToken.mockImplementation(() => {
        throw new UnauthorizedException("Invalid token");
      });

      const error = await service.logout("broken.token").catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.getStatus()).toBe(401);
      expect(getSession).not.toHaveBeenCalled();
      expect(revokeSession).not.toHaveBeenCalled();
    });
  });

  describe("logout: Redis unavailable (§60)", () => {
    it("выбрасывает 500 без внутренних деталей, session не отзывается", async () => {
      getSession.mockRejectedValue(
        new Error("connect ECONNREFUSED 127.0.0.1:6379"),
      );

      const error = await service.logout("raw.refresh.token").catch((e) => e);

      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect(error.getStatus()).toBe(500);
      expect(JSON.stringify(error.getResponse())).not.toContain("ECONNREFUSED");
      expect(JSON.stringify(error.getResponse())).not.toContain("127.0.0.1");
      expect(revokeSession).not.toHaveBeenCalled();
    });

    it("ошибка при revoke → 500; token и hash не попадают в логи (§46)", async () => {
      revokeSession.mockRejectedValue(new Error("redis down"));

      const error = await service.logout("raw.refresh.token").catch((e) => e);

      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect(error.getStatus()).toBe(500);

      const logged = JSON.stringify([
        loggerErrorSpy.mock.calls,
        loggerWarnSpy.mock.calls,
        loggerDebugSpy.mock.calls,
      ]);
      expect(logged).not.toContain("raw.refresh.token");
      expect(logged).not.toContain("stored.hmac.hash");
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

  describe("refresh: успешное обновление (§65 SPEC.md)", () => {
    const NEW_SESSION_ID = "33333333-3333-4333-8333-333333333333";
    const NEW_TOKEN_FAMILY_ID = "44444444-4444-4444-8444-444444444444";

    beforeEach(() => {
      (randomUUID as unknown as jest.Mock).mockReset();
      (randomUUID as unknown as jest.Mock)
        .mockReturnValueOnce(NEW_SESSION_ID)
        .mockReturnValueOnce(NEW_TOKEN_FAMILY_ID);
      hashRefreshToken
        .mockReturnValueOnce("stored.hmac.hash")
        .mockReturnValueOnce("new.stored.hmac.hash");
    });

    it("верифицирует JWT, сравнивает хеш, отзывает старую сессию, создаёт новую и возвращает токены", async () => {
      const result = await service.refresh("raw.refresh.token");

      expect(verifyRefreshToken).toHaveBeenCalledWith("raw.refresh.token");
      expect(getSession).toHaveBeenCalledWith(SESSION_ID);
      expect(hashRefreshToken).toHaveBeenCalledWith("raw.refresh.token");
      expect(revokeSession).toHaveBeenCalledTimes(1);
      expect(revokeSession).toHaveBeenCalledWith(SESSION_ID);
      expect(createSession).toHaveBeenCalledTimes(1);
      expect(createSession).toHaveBeenCalledWith(
        NEW_SESSION_ID,
        USER.id,
        "new.stored.hmac.hash",
        NEW_TOKEN_FAMILY_ID,
      );
      expect(generateAccessToken).toHaveBeenCalledWith(USER.id, NEW_SESSION_ID);
      expect(generateRefreshToken).toHaveBeenCalledWith(
        USER.id,
        NEW_SESSION_ID,
      );
      expect(result).toEqual({
        accessToken: "raw.access.token",
        refreshToken: "raw.refresh.token",
      });
    });

    it("отсутствие cookie → 401 без обращений к Redis", async () => {
      const error = await service.refresh(undefined).catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.getStatus()).toBe(401);
      expect(error.getResponse()).toMatchObject({
        message: "Invalid credentials",
      });
      expect(verifyRefreshToken).not.toHaveBeenCalled();
      expect(getSession).not.toHaveBeenCalled();
      expect(revokeSession).not.toHaveBeenCalled();
      expect(createSession).not.toHaveBeenCalled();
    });
  });

  describe("refresh: отказ (§65 строгая семантика)", () => {
    it("невалидный / просроченный JWT → 401 до обращения к Redis", async () => {
      verifyRefreshToken.mockImplementation(() => {
        throw new UnauthorizedException("Invalid token");
      });

      const error = await service.refresh("broken.token").catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.getStatus()).toBe(401);
      expect(getSession).not.toHaveBeenCalled();
      expect(revokeSession).not.toHaveBeenCalled();
      expect(createSession).not.toHaveBeenCalled();
    });

    it("сессия отсутствует в Redis → 401, session не отзывается", async () => {
      getSession.mockResolvedValue(null);

      const error = await service.refresh("raw.refresh.token").catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.getStatus()).toBe(401);
      expect(error.getResponse()).toMatchObject({
        message: "Invalid credentials",
      });
      expect(revokeSession).not.toHaveBeenCalled();
      expect(createSession).not.toHaveBeenCalled();
    });

    it("hash mismatch (replay) → 401, сессия отозвана (§32)", async () => {
      getSession.mockResolvedValue({
        userId: USER.id,
        refreshTokenHash: "rotated.hmac.hash",
        tokenFamilyId: TOKEN_FAMILY_ID,
        createdAt: "2026-08-24T00:00:00.000Z",
        lastUsedAt: "2026-08-24T00:00:00.000Z",
      });

      const error = await service.refresh("old.refresh.token").catch((e) => e);

      expect(hashRefreshToken).toHaveBeenCalledWith("old.refresh.token");
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.getStatus()).toBe(401);
      expect(revokeSession).toHaveBeenCalledTimes(1);
      expect(revokeSession).toHaveBeenCalledWith(SESSION_ID);
      expect(createSession).not.toHaveBeenCalled();
    });
  });

  describe("refresh: Redis unavailable (§60)", () => {
    it("getSession реджектится → 500 без внутренних деталей, session не отзывается", async () => {
      getSession.mockRejectedValue(
        new Error("connect ECONNREFUSED 127.0.0.1:6379"),
      );

      const error = await service.refresh("raw.refresh.token").catch((e) => e);

      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect(error.getStatus()).toBe(500);
      expect(JSON.stringify(error.getResponse())).not.toContain("ECONNREFUSED");
      expect(revokeSession).not.toHaveBeenCalled();
      expect(createSession).not.toHaveBeenCalled();
    });

    it("createSession реджектится → 500, старая сессия уже отозвана (§65)", async () => {
      createSession.mockRejectedValue(
        new Error("connect ECONNREFUSED 127.0.0.1:6379"),
      );

      const error = await service.refresh("raw.refresh.token").catch((e) => e);

      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect(error.getStatus()).toBe(500);
      expect(revokeSession).toHaveBeenCalledTimes(1);
    });

    it("токены и хеши не попадают в логи (§46)", async () => {
      getSession.mockRejectedValue(new Error("redis down"));

      await service.refresh("raw.refresh.token").catch(() => undefined);

      const logged = JSON.stringify([
        loggerErrorSpy.mock.calls,
        loggerWarnSpy.mock.calls,
        loggerDebugSpy.mock.calls,
      ]);
      expect(logged).not.toContain("raw.refresh.token");
      expect(logged).not.toContain("stored.hmac.hash");
    });
  });
});
