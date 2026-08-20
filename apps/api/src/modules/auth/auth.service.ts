import { randomUUID } from "node:crypto";
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: value import required for NestJS DI metadata
import { ConfigService } from "@nestjs/config";
import type { RegisterDto } from "@packages/dto";
import argon2 from "argon2";
// biome-ignore lint/style/useImportType: value import required for NestJS DI metadata
import { PrismaService } from "../../prisma/prisma.service";
// biome-ignore lint/style/useImportType: value import required for NestJS DI metadata
import { UsersService } from "../users/users.service";
// biome-ignore lint/style/useImportType: value import required for NestJS DI metadata
import { AuthSessionService } from "./services/auth-session.service";
// biome-ignore lint/style/useImportType: value import required for NestJS DI metadata
import { TokenService } from "./services/token.service";

/** Результат успешной регистрации. */
export interface RegisterResult {
  accessToken: string;
  refreshToken: string;
}

/**
 * Сервис аутентификации (§37, §48 SPEC.md).
 *
 * Реализует алгоритм регистрации пользователя: валидация, проверка уникальности,
 * хеширование пароля, создание пользователя, генерация JWT, создание Redis session.
 * При ошибке Redis — компенсация: удаление пользователя (§48 SPEC.md).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * @param usersService - Сервис управления пользователями.
   * @param tokenService - Сервис генерации и верификации JWT.
   * @param sessionService - Сервис управления authentication sessions в Redis.
   * @param prisma - Глобальный `PrismaService` для компенсации (§48 SPEC.md).
   * @param configService - Конфигурация приложения (секция `argon2`).
   */
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly sessionService: AuthSessionService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Регистрирует нового пользователя (§37 SPEC.md).
   *
   * Алгоритм:
   * 1. Нормализация email (выполнена DTO-схемой).
   * 2. Проверка существования пользователя → `409 Conflict`.
   * 3. Хеширование пароля через Argon2id.
   * 4. Создание пользователя в PostgreSQL (catch `P2002` → `409`).
   * 5. Генерация access и refresh JWT.
   * 6. Создание Redis session с HMAC-хешем refresh token.
   * 7. Возврат `{ accessToken, refreshToken }`.
   *
   * Компенсация (§48 SPEC.md): при ошибке Redis после создания user —
   * best-effort удаление user, `500` без внутренних деталей.
   *
   * @param dto - Валидированный DTO регистрации (email уже нормализован).
   * @returns Access и refresh токены.
   * @throws {ConflictException} Если email уже зарегистрирован.
   * @throws {InternalServerErrorException} При ошибке Redis или другой непредвиденной ошибке.
   */
  async register(dto: RegisterDto): Promise<RegisterResult> {
    const { email, password } = dto;

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException("Email already registered");
    }

    const passwordHash = await this.hashPassword(password);

    let userId: string;
    try {
      const user = await this.usersService.create({ email, passwordHash });
      userId = user.id;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        throw new ConflictException("Email already registered");
      }
      throw error;
    }

    const sessionId = randomUUID();
    const tokenFamilyId = randomUUID();

    const accessToken = this.tokenService.generateAccessToken(
      userId,
      sessionId,
    );
    const refreshToken = this.tokenService.generateRefreshToken(
      userId,
      sessionId,
    );

    const refreshTokenHash = this.tokenService.hashRefreshToken(refreshToken);

    try {
      await this.sessionService.createSession(
        userId,
        refreshTokenHash,
        tokenFamilyId,
      );
    } catch (error) {
      this.logger.error(
        "Redis unavailable after user creation — compensating",
        error instanceof Error ? error.message : String(error),
      );
      await this.compensateUserDeletion(userId);
      throw new InternalServerErrorException();
    }

    return { accessToken, refreshToken };
  }

  /**
   * Хеширует пароль через Argon2id с параметрами из конфигурации (§11, §12 SPEC.md).
   *
   * @param password - Пароль в открытом виде.
   * @returns Argon2id хеш пароля.
   */
  private async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: this.configService.get<number>("argon2.memoryCost"),
      timeCost: this.configService.get<number>("argon2.timeCost"),
      parallelism: this.configService.get<number>("argon2.parallelism"),
    });
  }

  /**
   * Best-effort удаление пользователя при компенсации (§48 SPEC.md).
   *
   * Ошибки удаления логируются, но не пробрасываются —
   * основной ответ остаётся `500 Internal Server Error`.
   *
   * @param userId - UUID пользователя для удаления.
   */
  private async compensateUserDeletion(userId: string): Promise<void> {
    try {
      await this.prisma.user.delete({ where: { id: userId } });
      this.logger.debug(`Compensated: deleted user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to compensate user deletion for ${userId}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
