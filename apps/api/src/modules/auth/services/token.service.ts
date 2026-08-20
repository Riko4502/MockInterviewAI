import { createHmac, randomUUID } from "node:crypto";
import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import { TOKEN_TYP_ACCESS, TOKEN_TYP_REFRESH } from "../auth.constants";

/** Payload JWT токена (§20, §24 SPEC.md). */
export interface TokenPayload {
  sub: string;
  sid: string;
  typ: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
}

/** Алгоритм JWT — явный allowlist (§33 SPEC.md). */
const JWT_ALGORITHM = "HS256";

/**
 * Сервис генерации и верификации JWT токенов (§33, §34, §38 SPEC.md).
 *
 * Отвечает за:
 * - Генерацию access и refresh JWT с claims `sub`, `sid`, `typ`, `iss`, `aud`, `iat`, `exp`, `jti`.
 * - Верификацию токенов с проверкой алгоритма (`HS256`), issuer, audience, expiration, typ.
 * - Хеширование refresh token через HMAC-SHA-256 для хранения в Redis.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  /**
   * @param configService - Конфигурация приложения (секция `jwt`, `refreshTokenHashSecret`).
   */
  constructor(private readonly configService: ConfigService) {}

  /**
   * Генерирует access token (§19, §20 SPEC.md).
   *
   * @param userId - UUID пользователя (`sub`).
   * @param sessionId - UUID сессии (`sid`).
   * @returns Подписанный JWT access token.
   */
  generateAccessToken(userId: string, sessionId: string): string {
    const payload: Omit<TokenPayload, "iat" | "exp"> = {
      sub: userId,
      sid: sessionId,
      typ: TOKEN_TYP_ACCESS,
      iss: this.configService.getOrThrow<string>("jwt.issuer"),
      aud: this.configService.getOrThrow<string>("jwt.audience"),
      jti: randomUUID(),
    };

    return jwt.sign(
      payload,
      this.configService.getOrThrow<string>("jwt.accessSecret"),
      {
        algorithm: JWT_ALGORITHM,
        expiresIn: (this.configService.get<string>("jwt.accessExpiresIn") ??
          "15m") as StringValue,
      },
    );
  }

  /**
   * Генерирует refresh token (§23, §24 SPEC.md).
   *
   * @param userId - UUID пользователя (`sub`).
   * @param sessionId - UUID сессии (`sid`).
   * @returns Подписанный JWT refresh token.
   */
  generateRefreshToken(userId: string, sessionId: string): string {
    const payload: Omit<TokenPayload, "iat" | "exp"> = {
      sub: userId,
      sid: sessionId,
      typ: TOKEN_TYP_REFRESH,
      iss: this.configService.getOrThrow<string>("jwt.issuer"),
      aud: this.configService.getOrThrow<string>("jwt.audience"),
      jti: randomUUID(),
    };

    return jwt.sign(
      payload,
      this.configService.getOrThrow<string>("jwt.refreshSecret"),
      {
        algorithm: JWT_ALGORITHM,
        expiresIn: (this.configService.get<string>("jwt.refreshExpiresIn") ??
          "7d") as StringValue,
      },
    );
  }

  /**
   * Верифицирует access token (§33 SPEC.md).
   *
   * Проверяет: алгоритм (`HS256`), подпись, issuer, audience, expiration, typ (`access`).
   *
   * @param token - JWT access token.
   * @returns Декодированный payload.
   * @throws {UnauthorizedException} При невалидном токене или несовпадении typ.
   */
  verifyAccessToken(token: string): TokenPayload {
    return this.verifyToken(token, TOKEN_TYP_ACCESS, "jwt.accessSecret");
  }

  /**
   * Верифицирует refresh token (§33 SPEC.md).
   *
   * Проверяет: алгоритм (`HS256`), подпись, issuer, audience, expiration, typ (`refresh`).
   *
   * @param token - JWT refresh token.
   * @returns Декодированный payload.
   * @throws {UnauthorizedException} При невалидном токене или несовпадении typ.
   */
  verifyRefreshToken(token: string): TokenPayload {
    return this.verifyToken(token, TOKEN_TYP_REFRESH, "jwt.refreshSecret");
  }

  /**
   * Вычисляет HMAC-SHA-256 хеш refresh token (§17, §34 SPEC.md).
   *
   * Используется для хранения в Redis — plaintext refresh token запрещён
   * к хранению (§17 SPEC.md).
   *
   * @param token - JWT refresh token (plaintext).
   * @returns Hex-строка HMAC-SHA-256 хеша.
   */
  hashRefreshToken(token: string): string {
    const secret = this.configService.getOrThrow<string>(
      "refreshTokenHashSecret",
    );
    return createHmac("sha256", secret).update(token).digest("hex");
  }

  /**
   * Внутренняя верификация JWT с проверкой typ (§33 SPEC.md).
   *
   * @param token - JWT токен.
   * @param expectedTyp - Ожидаемый тип (`access` или `refresh`).
   * @param secretKey - Ключ конфигурации для secret.
   * @returns Декодированный payload.
   * @throws {UnauthorizedException} При невалидном токене или несовпадении typ.
   */
  private verifyToken(
    token: string,
    expectedTyp: string,
    secretKey: string,
  ): TokenPayload {
    const secret = this.configService.getOrThrow<string>(secretKey);

    try {
      const decoded = jwt.verify(token, secret, {
        algorithms: [JWT_ALGORITHM],
        issuer: this.configService.getOrThrow<string>("jwt.issuer"),
        audience: this.configService.getOrThrow<string>("jwt.audience"),
      }) as jwt.JwtPayload;

      if (decoded.typ !== expectedTyp) {
        this.logger.warn(
          `Token type mismatch: expected "${expectedTyp}", got "${decoded.typ}"`,
        );
        throw new UnauthorizedException("Invalid token type");
      }

      return decoded as unknown as TokenPayload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.warn(
        `Token verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new UnauthorizedException("Invalid token");
    }
  }
}
