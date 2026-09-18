import { createHash, randomBytes, randomUUID } from "node:crypto";
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
import type {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from "@packages/dto";
import { SystemPermission } from "@packages/types";
import argon2 from "argon2";
import {
  publishUserRevocation,
  publishUserRevocationOrThrow,
} from "../../common/pubsub/revocation";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { MailService } from "../mail/mail.service";
import { UsersService } from "../users/users.service";
import {
  PASSWORD_RESET_TOKEN_TTL_SECONDS,
  REDIS_DUMMY_PASSWORD_RESET_PREFIX,
  REDIS_PASSWORD_RESET_PREFIX,
} from "./auth.constants";
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

/** 30 дней в миллисекундах (окно восстановления аккаунта) */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
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
   * @param redisService - Глобальный `RedisService` для публикации ревокаций.
   * @param mailService - Сервис отправки почтовых сообщений.
   */
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly sessionService: AuthSessionService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Регистрирует нового пользователя (§37 SPEC.md).
   *
   * Алгоритм:
   * 1. Нормализация email (выполнена DTO-схемой).
   * 2. Проверка существования пользователя → `409 Conflict`.
   * 3. Хеширование пароля через Argon2id.
   * 4. Создание пользователя в PostgreSQL с дефолтной ролью USER (catch `P2002` → `409`).
   * 5. Извлечение роли и прав пользователя.
   * 6. Генерация access и refresh JWT.
   * 7. Создание Redis session с HMAC-хешем refresh token.
   * 8. Возврат `{ accessToken, refreshToken }`.
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

    const userWithRole = await this.usersService.findUserWithRoleById(userId);
    const permissions =
      userWithRole?.role?.permissions ?? SystemPermission.NONE;
    const generation = userWithRole?.generation ?? 1;

    const sessionId = randomUUID();
    const tokenFamilyId = randomUUID();

    const accessToken = this.tokenService.generateAccessToken(
      userId,
      sessionId,
      permissions,
      generation,
    );
    const refreshToken = this.tokenService.generateRefreshToken(
      userId,
      sessionId,
      generation,
    );

    const refreshTokenHash = this.tokenService.hashRefreshToken(refreshToken);

    try {
      await this.sessionService.createSession(
        sessionId,
        userId,
        refreshTokenHash,
        tokenFamilyId,
        generation,
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
   * 1. Поиск пользователя по email (с ролью и правами) → не найден → фиктивная argon2-проверка
   *    против `DUMMY_PASSWORD_HASH` (выравнивание времени ответа) → generic `401`.
   * 2. Проверка пароля через `argon2.verify()` → не совпал → тот же generic `401`
   *    (§59 SPEC.md: тела ответов байт-в-байт совпадают, причина не раскрывается).
   * 3. Успех: новая authentication session — каждый логин порождает новый
   *    `sessionId` и новый `tokenFamilyId` (§13–17 SPEC.md); генерация access +
   *    refresh JWT с актуальной ролью и правами; запись session в Redis с HMAC-хешем refresh token.
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

    const user = await this.usersService.findUserWithRoleByEmail(email);

    // Единый кодовый путь: ровно одна argon2-проверка против хеша реального
    // пользователя либо против dummy-хеша — идентичный ответ и время для
    // обоих случаев отказа (§59 SPEC.md).
    const passwordHash = user?.passwordHash ?? this.dummyPasswordHash;
    const passwordValid = await argon2.verify(passwordHash, password);

    if (!user || !passwordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.isActive === false) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Ре-верификация пользователя после ресурсоёмкого argon2.verify для устранения CWE-362 гонок
    const freshUser = await this.usersService.findUserWithRoleById(user.id);
    if (
      !freshUser ||
      freshUser.isActive === false ||
      freshUser.generation !== user.generation
    ) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (freshUser.deletedAt) {
      const elapsedMs = Date.now() - freshUser.deletedAt.getTime();
      if (elapsedMs > THIRTY_DAYS_MS) {
        throw new UnauthorizedException("Invalid credentials");
      }

      await this.usersService.restoreAccount(freshUser.id);
      this.logger.log(
        `Account ${freshUser.id} automatically restored upon login`,
      );
    }

    const sessionId = randomUUID();
    const tokenFamilyId = randomUUID();

    const permissions = freshUser.role?.permissions ?? SystemPermission.NONE;
    const generation = freshUser.generation ?? 1;

    const accessToken = this.tokenService.generateAccessToken(
      freshUser.id,
      sessionId,
      permissions,
      generation,
    );
    const refreshToken = this.tokenService.generateRefreshToken(
      freshUser.id,
      sessionId,
      generation,
    );

    const refreshTokenHash = this.tokenService.hashRefreshToken(refreshToken);

    try {
      await this.sessionService.createSession(
        sessionId,
        freshUser.id,
        refreshTokenHash,
        tokenFamilyId,
        generation,
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(
        "Redis unavailable during login",
        error instanceof Error ? error.message : String(error),
      );
      throw new InternalServerErrorException();
    }

    return { accessToken, refreshToken };
  }

  /**
   * Выполняет выход пользователя из текущей сессии (§60 SPEC.md).
   *
   * Алгоритм:
   * 1. Извлечь refresh token из cookie.
   * 2. Валидация токена через `verifyRefreshToken`.
   * 3. Найти session в Redis по `sid` из payload.
   * 4. Сверить HMAC-хеш токена с сохранённым `session.refreshTokenHash`.
   * 5. Удалить session из Redis.
   * 6. Вызывающий код сбрасывает HTTP-only cookie.
   *
   * Все условия отказа 1–4 возвращают generic `401 Unauthorized` (§60 SPEC.md).
   * Ошибки Redis → `500 Internal Server Error`, cookie НЕ сбрасывается (§60).
   *
   * @param refreshToken - Refresh token из cookie.
   * @throws {UnauthorizedException} При невалидном токене или несовпадении сессии (§60).
   * @throws {InternalServerErrorException} При ошибке Redis (§60).
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

      // Оповещаем Realtime через Pub/Sub: мгновенный сброс авторизации на всех
      // репликах (Phase A). Best-effort — сбой публикации не влияет на logout.
      await publishUserRevocation(this.redisService, session.userId);
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
   * `request.user.sub` — его UUID).
   * Инкрементирует generation пользователя в БД для предотвращения гонок с параллельным логином
   * и удаляет сессии пользователя в Redis. Access token становится недействительным
   * сразу после отзыва, так как AccessTokenGuard проверяет валидность сессии в Redis.
   *
   * @param userId - UUID пользователя, чьи сессии отзываются.
   * @throws {InternalServerErrorException} При ошибке Redis или БД (§66).
   */
  async logoutAll(userId: string): Promise<void> {
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { generation: { increment: 1 } },
        select: { generation: true },
      });
      const preIncrementGeneration = updatedUser.generation - 1;
      await this.sessionService.revokeAllUserSessions(
        userId,
        new Date(),
        preIncrementGeneration,
      );
      // Оповещаем Realtime через Pub/Sub: мгновенный сброс авторизации на всех
      // репликах (Phase A). Best-effort — сбой публикации не влияет на logout.
      await publishUserRevocation(this.redisService, userId);
    } catch (error) {
      this.logger.error(
        "Redis or database unavailable during logoutAll",
        error instanceof Error ? error.message : String(error),
      );
      throw new InternalServerErrorException();
    }
  }

  /**
   * Изменяет пароль авторизованного пользователя (§67 SPEC.md).
   *
   * Алгоритм:
   * 1. Поиск пользователя по `userId`.
   * 2. Проверка `currentPassword` через `argon2.verify()`.
   * 3. Проверка `currentPassword !== newPassword` (400, если совпадают).
   * 4. Хеширование `newPassword` через Argon2id.
   * 5. Обновление `passwordHash` в PostgreSQL.
   * 6. Отзыв всех active authentication sessions пользователя в Redis
   *    `revokeAllUserSessions` (access token становится недействительным сразу
   *    после отзыва, так как AccessTokenGuard получает null из getSession
   *    и выбрасывает UnauthorizedException, а не после истечения TTL;
   *    refresh-сессии сбрасываются).
   * 7. Вызывающий код сбрасывает HTTP-only cookie.
   *
   * @param userId - UUID пользователя из `request.user.sub`.
   * @param dto - Валидированный DTO (currentPassword, newPassword).
   * @throws {NotFoundException} Если пользователь не найден (404).
   * @throws {UnauthorizedException} Если текущий пароль неверен (401).
   * @throws {BadRequestException} Если новый пароль совпадает с текущим (400).
   * @throws {ConflictException} Если состояние пользователя изменилось параллельно (409).
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

    let taskId: string | undefined;
    let taskCreatedAt: Date | undefined;
    let taskGeneration: number | undefined;

    await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.user.updateMany({
        where: {
          id: userId,
          generation: user.generation,
        },
        data: {
          passwordHash: newPasswordHash,
          generation: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException("User state has changed, please try again");
      }

      const preIncrementGeneration = user.generation;
      const task = await tx.authRevocationTask.create({
        data: {
          userId,
          generation: preIncrementGeneration,
        },
      });
      taskId = task.id;
      taskCreatedAt = task.createdAt;
      taskGeneration = preIncrementGeneration;
    });

    try {
      await this.revokeSessionsWithRetry(userId, taskCreatedAt, taskGeneration);
      if (taskId) {
        await this.prisma.authRevocationTask
          .delete({ where: { id: taskId } })
          .catch(() => undefined);
      }
    } catch (error) {
      // При сбое Redis задача остаётся в PostgreSQL и будет обработана воркером повторно
      this.logger.error(
        `Failed to revoke sessions / publish revocation for user ${userId} during changePassword (persisted for worker retry)`,
        error instanceof Error ? error.message : String(error),
      );
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
   *    `tokenFamilyId`), извлечь актуальную роль и права пользователя из БД,
   *    новые access/refresh JWT, запись в Redis, Set-Cookie с новым refresh token.
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
        // Replay detected → глобальная ревокация пользователя на всех репликах
        // (Phase A). Best-effort — не влияет на 401-ответ.
        await publishUserRevocation(this.redisService, session.userId);
        throw new UnauthorizedException("Invalid credentials");
      }

      if (
        payload.generation !== undefined &&
        (session.generation ?? 1) !== payload.generation
      ) {
        await this.sessionService.revokeSession(payload.sid);
        throw new UnauthorizedException("Invalid credentials");
      }

      const user = await this.usersService.findUserWithRoleById(session.userId);
      const userGeneration = user?.generation ?? 1;
      const sessionGeneration = session.generation ?? 1;
      if (
        !user ||
        user.deletedAt ||
        user.isActive === false ||
        sessionGeneration !== userGeneration
      ) {
        await this.sessionService.revokeSession(payload.sid);
        throw new UnauthorizedException("Invalid credentials");
      }

      await this.sessionService.revokeSession(payload.sid);

      const newSessionId = randomUUID();
      const newTokenFamilyId = randomUUID();

      const permissions = user.role?.permissions ?? SystemPermission.NONE;
      const generation = user.generation ?? 1;

      const newAccessToken = this.tokenService.generateAccessToken(
        session.userId,
        newSessionId,
        permissions,
        generation,
      );
      const newRefreshToken = this.tokenService.generateRefreshToken(
        session.userId,
        newSessionId,
        generation,
      );

      const newRefreshTokenHash =
        this.tokenService.hashRefreshToken(newRefreshToken);

      await this.sessionService.createSession(
        newSessionId,
        session.userId,
        newRefreshTokenHash,
        newTokenFamilyId,
        generation,
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
   * Инициирует процедуру сброса пароля (Forgot Password).
   *
   * Алгоритм:
   * 1. Поиск пользователя по email.
   * 2. Если пользователь найден (и активен):
   *    a. Генерация криптографически стойкого случайного raw токена (32 байта, hex).
   *    b. Вычисление SHA-256 хеша токена.
   *    c. Сохранение `auth:password-reset:{tokenHash}` = `userId` в Redis с TTL 15 минут.
   *    d. Отправка письма со ссылкой для восстановления через `MailService`.
   * 3. Если пользователь не найден — намеренно не выбрасывается ошибка (anti-enumeration).
   * 4. Возвращается единый 200 OK ответ с сообщением.
   *
   * @param dto - DTO с email пользователя.
   * @returns Сообщение о подтверждении отправки письма.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    if (user && !user.deletedAt) {
      try {
        const key = `${REDIS_PASSWORD_RESET_PREFIX}${tokenHash}`;

        await this.redisService.set(
          key,
          user.id,
          PASSWORD_RESET_TOKEN_TTL_SECONDS,
        );

        // TODO: Заменить мок-отправку на продакшн MailService с react-email шаблонами после настройки SMTP
        await this.mailService.sendPasswordResetEmail(user.email, rawToken);
      } catch (error) {
        this.logger.error(
          "Failed to process forgotPassword background actions (Redis/Mail)",
          error instanceof Error ? error.message : String(error),
        );
      }
    } else {
      // Безопасная неперсистентная Redis round-trip операция со случайным временным ключом (anti-enumeration / timing attack mitigation)
      try {
        const dummyKey = `${REDIS_DUMMY_PASSWORD_RESET_PREFIX}${tokenHash}`;
        await this.redisService.set(dummyKey, "0", 1);
        await this.redisService.delete(dummyKey);
      } catch (error) {
        this.logger.error(
          "Failed to process forgotPassword dummy background actions (Redis)",
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    return {
      message:
        "Если указанный email зарегистрирован, на него отправлена ссылка для сброса пароля",
    };
  }

  /**
   * Устанавливает новый пароль по токену сброса (Reset Password).
   *
   * Алгоритм:
   * 1. Вычисление SHA-256 хеша переданного raw токена.
   * 2. Атомарное чтение и удаление ключа из Redis (`getdel`).
   * 3. Если ключ не найден / истек — `BadRequestException` ("Недействительный или истекший токен сброса пароля").
   * 4. Поиск пользователя по `userId`. Если не найден — `BadRequestException`.
   * 5. Хеширование нового пароля через Argon2id.
   * 6. В единой транзакции PostgreSQL: обновление `passwordHash` и создание durable-задачи ревокации сессий (`AuthRevocationTask`).
   * 7. Немедленная попытка отзыва всех активных refresh-сессий пользователя в Redis и Pub/Sub уведомление.
   *    - При успехе: удаление durable-задачи из PostgreSQL.
   *    - При сбое Redis: логирование ошибки, задача сохраняется в БД для фонового воркера (`SessionRevocationCron`).
   * 8. Возврат `{ message: "Пароль успешно изменен" }`.
   *
   * @param dto - DTO с токеном и новым паролем.
   * @returns Сообщение об успешном сбросе пароля.
   * @throws {BadRequestException} Если токен недействителен или истек.
   * @throws {InternalServerErrorException} При ошибке Redis до потребления токена.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const { token, newPassword } = dto;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const key = `${REDIS_PASSWORD_RESET_PREFIX}${tokenHash}`;

    let userId: string | null;
    try {
      userId = await this.redisService.getdel(key);
    } catch (error) {
      this.logger.error(
        "Redis unavailable during resetPassword",
        error instanceof Error ? error.message : String(error),
      );
      throw new InternalServerErrorException();
    }

    if (!userId) {
      throw new BadRequestException(
        "Недействительный или истекший токен сброса пароля",
      );
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException("Пользователь не найден");
    }

    const newPasswordHash = await this.hashPassword(newPassword);

    // Создаем durable-задачу в той же транзакции PostgreSQL, что и изменение пароля
    let taskId: string | undefined;
    let taskCreatedAt: Date | undefined;
    let taskGeneration: number | undefined;
    await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: newPasswordHash,
          generation: { increment: 1 },
        },
        select: {
          generation: true,
        },
      });
      const preIncrementGeneration = updatedUser.generation - 1;
      const task = await tx.authRevocationTask.create({
        data: {
          userId,
          generation: preIncrementGeneration,
        },
      });
      taskId = task.id;
      taskCreatedAt = task.createdAt;
      taskGeneration = preIncrementGeneration;
    });

    try {
      await this.revokeSessionsWithRetry(userId, taskCreatedAt, taskGeneration);

      // При успешной ревокации удаляем durable задачу
      if (taskId) {
        await this.prisma.authRevocationTask
          .delete({
            where: { id: taskId },
          })
          .catch(() => undefined);
      }
    } catch (error) {
      // При сбое Redis задача остаётся в PostgreSQL и будет обработана воркером повторно
      this.logger.error(
        `Failed to revoke sessions / publish revocation for user ${userId} during resetPassword (persisted for worker retry)`,
        error instanceof Error ? error.message : String(error),
      );
    }

    return {
      message: "Пароль успешно изменен",
    };
  }

  /**
   * Отзывает все активные сессии пользователя с повторными попытками.
   */
  private async revokeSessionsWithRetry(
    userId: string,
    maxCreatedAt?: Date | string,
    maxGeneration?: number,
    retries = 3,
    delayMs = 50,
  ): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.sessionService.revokeAllUserSessions(
          userId,
          maxCreatedAt,
          maxGeneration,
        );
        await publishUserRevocationOrThrow(this.redisService, userId);
        return;
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
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
