import { createHmac, randomUUID } from "node:crypto";
import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import jwt from "jsonwebtoken";
import { TokenService } from "./token.service";

const ACCESS_SECRET = "test-access-secret-0123456789abcdef";
const REFRESH_SECRET = "test-refresh-secret-fedcba9876543210";
const HASH_SECRET = "test-refresh-hash-secret-0123456789abcdef";

const USER_ID = randomUUID();
const SESSION_ID = randomUUID();

const ISSUER = "mock-interview-ai";
const AUDIENCE = "mock-interview-web";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LoggerAccessor = {
  logger: {
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
  };
};

function createConfigService(): ConfigService {
  const values: Record<string, unknown> = {
    "jwt.issuer": ISSUER,
    "jwt.audience": AUDIENCE,
    "jwt.accessSecret": ACCESS_SECRET,
    "jwt.refreshSecret": REFRESH_SECRET,
    "jwt.accessExpiresIn": "15m",
    "jwt.refreshExpiresIn": "7d",
    refreshTokenHashSecret: HASH_SECRET,
  };
  const missing = (key: string): Error => new Error(`Missing config: ${key}`);
  return {
    get: jest.fn().mockImplementation((key: string) => values[key]),
    getOrThrow: jest.fn().mockImplementation((key: string) => {
      if (!(key in values)) throw missing(key);
      return values[key];
    }),
  } as unknown as ConfigService;
}

describe("TokenService", () => {
  let service: TokenService;

  beforeEach(() => {
    service = new TokenService(createConfigService());
    jest
      .spyOn((service as unknown as LoggerAccessor).logger, "warn")
      .mockImplementation(() => undefined);
    jest
      .spyOn((service as unknown as LoggerAccessor).logger, "error")
      .mockImplementation(() => undefined);
    jest
      .spyOn((service as unknown as LoggerAccessor).logger, "debug")
      .mockImplementation(() => undefined);
  });

  describe("generateAccessToken", () => {
    it("генерирует JWT с claims sub, sid, typ=access, iss, aud, jti, iat, exp=15m", () => {
      const before = Math.floor(Date.now() / 1000);
      const token = service.generateAccessToken(USER_ID, SESSION_ID);
      const decoded = jwt.decode(token) as jwt.JwtPayload;

      expect(typeof token).toBe("string");
      expect(decoded.sub).toBe(USER_ID);
      expect(decoded.sid).toBe(SESSION_ID);
      expect(decoded.typ).toBe("access");
      expect(decoded.iss).toBe(ISSUER);
      expect(decoded.aud).toBe(AUDIENCE);
      expect(decoded.jti).toMatch(UUID_REGEX);
      expect(decoded.iat).toBeGreaterThanOrEqual(before);
      expect(Number(decoded.exp) - Number(decoded.iat)).toBe(900);

      jwt.verify(token, ACCESS_SECRET, {
        algorithms: ["HS256"],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
    });
  });

  describe("generateRefreshToken", () => {
    it("генерирует JWT с typ=refresh и exp=7d", () => {
      const token = service.generateRefreshToken(USER_ID, SESSION_ID);
      const decoded = jwt.decode(token) as jwt.JwtPayload;

      expect(decoded.sub).toBe(USER_ID);
      expect(decoded.sid).toBe(SESSION_ID);
      expect(decoded.typ).toBe("refresh");
      expect(decoded.iss).toBe(ISSUER);
      expect(decoded.aud).toBe(AUDIENCE);
      expect(decoded.jti).toMatch(UUID_REGEX);
      expect(Number(decoded.exp) - Number(decoded.iat)).toBe(604800);

      jwt.verify(token, REFRESH_SECRET, {
        algorithms: ["HS256"],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
    });
  });

  describe("разные JWT secrets", () => {
    it("access подписан access secret, refresh — refresh secret (cross-verify падает)", () => {
      const accessToken = service.generateAccessToken(USER_ID, SESSION_ID);
      const refreshToken = service.generateRefreshToken(USER_ID, SESSION_ID);

      expect(() => jwt.verify(accessToken, REFRESH_SECRET)).toThrow(
        jwt.JsonWebTokenError,
      );
      expect(() => jwt.verify(refreshToken, ACCESS_SECRET)).toThrow(
        jwt.JsonWebTokenError,
      );
    });

    it("jti access и refresh токенов различаются", () => {
      const accessToken = service.generateAccessToken(USER_ID, SESSION_ID);
      const refreshToken = service.generateRefreshToken(USER_ID, SESSION_ID);

      const accessDecoded = jwt.decode(accessToken) as jwt.JwtPayload;
      const refreshDecoded = jwt.decode(refreshToken) as jwt.JwtPayload;

      expect(accessDecoded.jti).not.toBe(refreshDecoded.jti);
    });
  });

  describe("корректный алгоритм", () => {
    it("reject wrong algorithm: HS512 с валидным секретом отклоняется", () => {
      const forged = jwt.sign(
        {
          sub: USER_ID,
          sid: SESSION_ID,
          typ: "access",
          iss: ISSUER,
          aud: AUDIENCE,
          jti: randomUUID(),
        },
        ACCESS_SECRET,
        { algorithm: "HS512" },
      );

      expect(() => service.verifyAccessToken(forged)).toThrow(
        UnauthorizedException,
      );
    });

    it("verifyAccessToken принимает HS256 и возвращает payload", () => {
      const token = service.generateAccessToken(USER_ID, SESSION_ID);
      const payload = service.verifyAccessToken(token);

      expect(payload.sub).toBe(USER_ID);
      expect(payload.sid).toBe(SESSION_ID);
      expect(payload.typ).toBe("access");
    });

    it("verifyAccessToken отклоняет refresh токен по typ mismatch", () => {
      const refreshToken = service.generateRefreshToken(USER_ID, SESSION_ID);

      expect(() => service.verifyAccessToken(refreshToken)).toThrow(
        UnauthorizedException,
      );
    });

    it("verifyRefreshToken принимает refresh и отклоняет access по typ", () => {
      const accessToken = service.generateAccessToken(USER_ID, SESSION_ID);
      const refreshToken = service.generateRefreshToken(USER_ID, SESSION_ID);

      expect(service.verifyRefreshToken(refreshToken).typ).toBe("refresh");
      expect(() => service.verifyRefreshToken(accessToken)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("hashRefreshToken", () => {
    it("возвращает HMAC-SHA-256 hex от секрета refreshTokenHashSecret", () => {
      const token = service.generateRefreshToken(USER_ID, SESSION_ID);
      const expected = createHmac("sha256", HASH_SECRET)
        .update(token)
        .digest("hex");

      expect(service.hashRefreshToken(token)).toBe(expected);
      expect(service.hashRefreshToken(token)).toMatch(/^[0-9a-f]{64}$/);
    });

    it("детерминирован и зависит от входа", () => {
      const first = service.hashRefreshToken("token-a");
      const second = service.hashRefreshToken("token-a");
      const other = service.hashRefreshToken("token-b");

      expect(first).toBe(second);
      expect(first).not.toBe(other);
    });
  });

  describe("generateRealtimeTicket / verifyRealtimeTicket", () => {
    it("генерирует тикет с typ=realtime, bound sessionId и exp=5m", () => {
      const before = Math.floor(Date.now() / 1000);
      const token = service.generateRealtimeTicket(
        USER_ID,
        SESSION_ID,
        "interview-123",
      );
      const decoded = jwt.decode(token) as jwt.JwtPayload;

      expect(typeof token).toBe("string");
      expect(decoded.sub).toBe(USER_ID);
      expect(decoded.sid).toBe(SESSION_ID);
      expect(decoded.sessionId).toBe("interview-123");
      expect(decoded.typ).toBe("realtime");
      expect(decoded.iss).toBe(ISSUER);
      expect(decoded.aud).toBe(AUDIENCE);
      expect(decoded.jti).toMatch(UUID_REGEX);
      expect(decoded.iat).toBeGreaterThanOrEqual(before);
      expect(Number(decoded.exp) - Number(decoded.iat)).toBe(300);

      jwt.verify(token, ACCESS_SECRET, {
        algorithms: ["HS256"],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
    });

    it("verifyRealtimeTicket принимает тикет и возвращает sessionId", () => {
      const token = service.generateRealtimeTicket(
        USER_ID,
        SESSION_ID,
        "interview-123",
      );
      const payload = service.verifyRealtimeTicket(token);

      expect(payload.sub).toBe(USER_ID);
      expect(payload.sid).toBe(SESSION_ID);
      expect(payload.sessionId).toBe("interview-123");
      expect(payload.typ).toBe("realtime");
    });

    it("verifyRealtimeTicket отклоняет access токен по typ mismatch", () => {
      const accessToken = service.generateAccessToken(USER_ID, SESSION_ID);

      expect(() => service.verifyRealtimeTicket(accessToken)).toThrow(
        UnauthorizedException,
      );
    });

    it("verifyAccessToken отклоняет тикет по typ mismatch", () => {
      const ticket = service.generateRealtimeTicket(
        USER_ID,
        SESSION_ID,
        "interview-123",
      );

      expect(() => service.verifyAccessToken(ticket)).toThrow(
        UnauthorizedException,
      );
    });

    it("тикет использует access-секрет (верификация refresh-секретом падает)", () => {
      const ticket = service.generateRealtimeTicket(
        USER_ID,
        SESSION_ID,
        "interview-123",
      );

      expect(() => jwt.verify(ticket, REFRESH_SECRET)).toThrow(
        jwt.JsonWebTokenError,
      );
    });
  });
});
