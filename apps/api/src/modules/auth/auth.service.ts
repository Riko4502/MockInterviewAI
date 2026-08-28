import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ChangePasswordDto, LoginDto, RegisterDto } from "@packages/dto";
import argon2 from "argon2";
import { PrismaService } from "../../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { AuthSessionService } from "./services/auth-session.service";
import { TokenService } from "./services/token.service";

/** Результат успешной регистрации. */
export interface RegisterResult {
  accessToken: string;
  refreshToken: string;
}

/** Результат успешного входа. */
export interface LoginResult {
  accessToken: string;
  refreshToken: string;
}

/** Результат успешного обновления токенов (§65 SPEC.md). */
export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

/**
 * Сервис аутентификации (§37, §48, §58 SPEC.md).
 *
 * Реализует алгоритмы регистрации пользователя (валидация, проверка
 * уникальности, хеширование пароля, создание пользователя, генерация JWT,
 * создание Redis session; при ошибке Redis — компенсация, §48 SPEC.md),
 * входа (проверка учётных данных без account enumeration, §58–§59 SPEC.md)
 * и обновления токенов — refresh token rotation (§65 SPEC.md).
 */
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private dummyPasswordHash = "";

  async onModuleInit(): Promise<void> {
    this.dummyPasswordHash = await argon2.hash("dummy-password", {
      type: argon2.argon2id,
      memoryCost: this.configService.get<number>("argon2.memoryCost"),
      timeCost: this.configService.get<number>("argon2.timeCost"),
      parallelism: this.configService.get<number>("argon2.parallelism"),
    });
  }

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
        sessionId,
        userId,
        refreshTokenHash,
        tokenFamilyId,
      );
    } catch (error) {
      this.logger.error(
        "Redis unavailable after user creation — compensating",
        error instanceof Error ? error.message : String(error),
      );
      await this.compensateUserCleanup(userId);
      throw new InternalServerErrorException();
    }

    return { accessToken, refreshToken };
  }

  /**
   * Выполняет вход пользователя (§58 SPEC.md).
   *
   * Алгоритм:
   * 1. Поиск пользователя по email → не найден → фиктивная argon2-проверка
   *    против `DUMMY_PASSWORD_HASH` (выравнивание времени ответа) → generic `401`.
   * 2. Проверка пароля через `argon2.verify()` → не совпал → тот же generic `401`
   *    (§59 SPEC.md: тела ответов байт-в-байт совпадают, причина не раскрывается).
   * 3. Успех: новая authentication session — каждый логин порождает новый
   *    `sessionId` и новый `tokenFamilyId` (§13–17 SPEC.md); генерация access +
   *    refresh JWT; запись session в Redis с HMAC-хешем refresh token.
   *
   * При ошибке Redis компенсация не требуется — пользователь не создаётся.
   *
   * @param dto - Валидированный DTO входа (email уже нормализован схемой).
   * @returns Access и refresh токены.
   * @throws {UnauthorizedException} Если пользователь не найден или пароль неверен
   *   (generic-ответ без указания причины, §59 SPEC.md).
   * @throws {InternalServerErrorException} При ошибке Redis.
   */
  async login(dto: LoginDto): Promise<LoginResult> {
    const { email, password } = dto;

    const user = await this.usersService.findByEmail(email);

    // Единый кодовый путь: ровно одна argon2-проверка против хеша реального
    // пользователя либо против dummy-хеша — идентичный ответ и время для
    // обоих случаев отказа (§59 SPEC.md).
    const passwordHash = user?.passwordHash ?? this.dummyPasswordHash;
    const passwordValid = await argon2.verify(passwordHash, password);

    if (!user || !passwordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const sessionId = randomUUID();
    const tokenFamilyId = randomUUID();

    const accessToken = this.tokenService.generateAccessToken(
      user.id,
      sessionId,
    );
    const refreshToken = this.tokenService.generateRefreshToken(
      user.id,
      sessionId,
    );

    const refreshTokenHash = this.tokenService.hashRefreshToken(refreshToken);

    try {
      await this.sessionService.createSession(
        sessionId,
        user.id,
        refreshTokenHash,
        tokenFamilyId,
      );
    } catch (error) {
      this.logger.error(
        "Redis unavailable during login",
        error instanceof Error ? error.message : String(error),
      );
      throw new InternalServerErrorException();
    }

    return { accessToken, refreshToken };
  }

  /**
   * Выполняет выход пользователя (§60 SPEC.md).
   *
   * Строгая семантика — logout успешен только при одновременном выполнении:
   * 1. refresh token присутствует (cookie);
   * 2. JWT валиден (HS256, подпись, issuer, audience, expiration,
   *    typ = `refresh` — проверяет `TokenService.verifyRefreshToken`);
   * 3. session `auth:session:{sid}` существует в Redis;
   * 4. `hashRefreshToken(token)` совпадает с сохранённым
   *    `session.refreshTokenHash` (защита от отзыва ротированной сессии
   *    старым токеном, §30–32 SPEC.md).
   *
   * Нарушение любого условия → generic `401`. При ошибке Redis → `500`
   * без внутренних деталей; компенсация не требуется.
   *
   * @param refreshToken - JWT refresh token из cookie (может отсутствовать).
   * @returns `void` — сессия отозвана в Redis.
   * @throws {UnauthorizedException} Если любое из условий 1–4 не выполнено
   *   (generic-ответ без указания причины).
   * @throws {InternalServerErrorException} При ошибке Redis.
   */
  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      throw new UnauthorizedException("Invalid credentials");
    }

    let payload: ReturnType<TokenService["verifyRefreshToken"]>;
    try {
      payload = this.tokenService.verifyRefreshToken(refreshToken);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        // Единый generic-ответ для всех условий отказа 1–4 (§60 SPEC.md)
        throw new UnauthorizedException("Invalid credentials");
      }
      throw error;
    }

    try {
      const session = await this.sessionService.getSession(payload.sid);

      if (
        !session ||
        session.refreshTokenHash !==
          this.tokenService.hashRefreshToken(refreshToken)
      ) {
        throw new UnauthorizedException("Invalid credentials");
      }

      await this.sessionService.revokeSession(payload.sid);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(
        "Redis unavailable during logout",
        error instanceof Error ? error.message : String(error),
      );
      throw new InternalServerErrorException();
    }
  }

  /**
   * Отзывает все authentication session пользователя (§66 SPEC.md).
   *
   * Вызывается для авторизованного пользователя (access token валиден,
   * `request.user.sub` — его UUID). Проходит по всем сессионным ключам
   * в Redis через `scanKeys` и удаляет те, что принадлежат пользователю.
   * Access token остаётся валидным до истечения (stateless, §66).
   *
   * @param userId - UUID пользователя, чьи сессии отзываются.
   * @throws {InternalServerErrorException} При ошибке Redis (§66).
   */
  async logoutAll(userId: string): Promise<void> {
    try {
      await this.sessionService.revokeAllUserSessions(userId);
    } catch (error) {
      this.logger.error(
        "Redis unavailable during logoutAll",
        error instanceof Error ? error.message : String(error),
      );
      throw new InternalServerErrorException();
    }
  }

  /**
   * Сменяет пароль авторизованного пользователя (§67 SPEC.md).
   *
   * ИНФОРМАЦИЯ: вызывается для авторизованного пользователя (access token
   * валиден, `request.user.sub` — его UUID). Алгоритм:
   * 1. Поиск пользователя по `userId` → не найден → `404 Not Found`.
   * 2. `argon2.verify(user.passwordHash, currentPassword)` → не совпал →
   *    generic `401` «Неверные учётные данные».
   * 3. `currentPassword === newPassword` → `400 Bad Request`.
   * 4. Хеширование нового пароля → обновление `passwordHash` в PostgreSQL.
   * 5. Отзыв ВСЕХ session пользователя в Redis (включая текущую) через
   *    `revokeAllUserSessions` (доступ token остаётся валидным до TTL,
   *    stateless; refresh cookie в любом случае сбрасывается контроллером).
   *
   * Ошибки Redis на шаге 5 → `500` без внутренних деталей; пароль уже
   * обновлён в PostgreSQL (транзакция PostgreSQL + best-effort Redis, §67).
   *
   * @param userId - UUID пользователя из payload access token.
   * @param dto - Валидированный DTO (currentPassword, newPassword).
   * @throws {NotFoundException} Если пользователь не найден (404).
   * @throws {UnauthorizedException} Если текущий пароль неверен (401).
   * @throws {BadRequestException} Если новый пароль совпадает с текущим (400).
   * @throws {InternalServerErrorException} При ошибке Redis (500).
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const { currentPassword, newPassword } = dto;

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException("Пользователь не найден");
    }

    const passwordValid = await argon2.verify(
      user.passwordHash,
      currentPassword,
    );
    if (!passwordValid) {
      throw new UnauthorizedException("Неверные учётные данные");
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException(
        "Новый пароль должен отличаться от текущего",
      );
    }

    const newPasswordHash = await this.hashPassword(newPassword);
    await this.usersService.updatePassword(userId, newPasswordHash);

    try {
      await this.sessionService.revokeAllUserSessions(userId);
    } catch (error) {
      this.logger.error(
        "Redis unavailable during changePassword — sessions not revoked",
        error instanceof Error ? error.message : String(error),
      );
      throw new InternalServerErrorException();
    }
  }

  /**
   * Выполняет обновление токенов — refresh token rotation (§65 SPEC.md).
   *
   * Алгоритм:
   * 1. cookie отсутствует → `401`.
   * 2. `verifyRefreshToken(token)` — HS256, issuer, audience, expiration,
   *    typ = `refresh` (§33).
   * 3. Невалиден → `401`, clear cookie.
   * 4. `getSession(sid)` из Redis.
   * 5. Сессия не найдена → `401`, clear cookie.
   * 6. `hashRefreshToken(token)` → сравнить с `session.refreshTokenHash`.
   * 7. Hash не совпадает → replay detected → `revokeSession(sid)` → `401`,
   *    clear cookie.
   * 8. Успех: `revokeSession(sid)`, создать новую сессию (новый `sessionId`,
   *    `tokenFamilyId`), новые access/refresh JWT, запись в Redis,
   *    Set-Cookie с новым refresh token.
   *
   * Ошибки Redis → `500 Internal Server Error`, cookie не сбрасывается (§60).
   *
   * @param refreshToken - JWT refresh token из cookie (может отсутствовать).
   * @returns Access и refresh токены.
   * @throws {UnauthorizedException} Если любое из условий 1–7 не выполнено
   *   (generic-ответ без указания причины).
   * @throws {InternalServerErrorException} При ошибке Redis.
   */
  async refresh(refreshToken?: string): Promise<RefreshResult> {
    if (!refreshToken) {
      throw new UnauthorizedException("Invalid credentials");
    }

    let payload: ReturnType<TokenService["verifyRefreshToken"]>;
    try {
      payload = this.tokenService.verifyRefreshToken(refreshToken);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw new UnauthorizedException("Invalid credentials");
      }
      throw error;
    }

    try {
      const session = await this.sessionService.getSession(payload.sid);

      if (!session) {
        throw new UnauthorizedException("Invalid credentials");
      }

      const incomingHash = this.tokenService.hashRefreshToken(refreshToken);
      if (session.refreshTokenHash !== incomingHash) {
        await this.sessionService.revokeSession(payload.sid);
        throw new UnauthorizedException("Invalid credentials");
      }

      await this.sessionService.revokeSession(payload.sid);

      const newSessionId = randomUUID();
      const newTokenFamilyId = randomUUID();

      const newAccessToken = this.tokenService.generateAccessToken(
        session.userId,
        newSessionId,
      );
      const newRefreshToken = this.tokenService.generateRefreshToken(
        session.userId,
        newSessionId,
      );

      const newRefreshTokenHash =
        this.tokenService.hashRefreshToken(newRefreshToken);

      await this.sessionService.createSession(
        newSessionId,
        session.userId,
        newRefreshTokenHash,
        newTokenFamilyId,
      );

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(
        "Redis unavailable during refresh",
        error instanceof Error ? error.message : String(error),
      );
      throw new InternalServerErrorException();
    }
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
  private async compensateUserCleanup(userId: string): Promise<void> {
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
