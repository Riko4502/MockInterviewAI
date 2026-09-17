import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  AdminUsersQueryDto,
  CreateUserAdminDto,
  PaginatedUsersAdminResponseDto,
  UpdateUserAdminDto,
  UserAdminDetailResponseDto,
  UserAdminResponseDto,
  UserStatusAdminDto,
} from "@packages/dto";
import { SystemRole } from "@packages/types";
import argon2 from "argon2";
import { USER_ADMIN_SELECT } from "../../../common/constants/user-select.constants";
import { publishUserRevocationOrThrow } from "../../../common/pubsub/revocation";
import type { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { RedisService } from "../../../redis/redis.service";
import { AuthSessionService } from "../../auth/services/auth-session.service";

/**
 * Сервис административного управления пользователями.
 *
 * Предоставляет полный спектр операций CRUD, пагинации, поиска, фильтрации,
 * смены ролей и управления статусом активности пользователя.
 * Строго исключает `passwordHash` из всех ответов.
 */
@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly authSessionService: AuthSessionService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Получает список пользователей с пагинацией, фильтрацией и сортировкой.
   *
   * @param query - Параметры пагинации, фильтрации и сортировки.
   * @returns Пагинированный список пользователей.
   */
  async getUsersList(
    query: AdminUsersQueryDto,
  ): Promise<PaginatedUsersAdminResponseDto> {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      isActive,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (role) {
      where.role = { slug: role };
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    let orderBy: Prisma.UserOrderByWithRelationInput;
    if (sortBy === "role") {
      orderBy = { role: { slug: sortOrder } };
    } else {
      orderBy = { [sortBy]: sortOrder };
    }

    const skip = (page - 1) * limit;

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_ADMIN_SELECT,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    const items: UserAdminResponseDto[] = users.map((user) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role?.slug ?? SystemRole.USER,
      isActive: user.isActive,
      deactivatedAt: user.deactivatedAt,
      avatarUrl: user.avatarUrl,
      telegramUsername: user.telegramUsername,
      gitUrl: user.gitUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    };
  }

  /**
   * Получает детальную информацию о пользователе со статистикой сессий.
   *
   * @param id - UUID пользователя.
   * @returns Детальный DTO пользователя.
   * @throws {NotFoundException} Если пользователь не найден.
   */
  async getUserById(id: string): Promise<UserAdminDetailResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...USER_ADMIN_SELECT,
        _count: {
          select: {
            sessions: true,
            participations: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role?.slug ?? SystemRole.USER,
      isActive: user.isActive,
      deactivatedAt: user.deactivatedAt,
      avatarUrl: user.avatarUrl,
      telegramUsername: user.telegramUsername,
      gitUrl: user.gitUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      sessionsCount: user._count.sessions,
      participationsCount: user._count.participations,
    };
  }

  /**
   * Создает нового пользователя администратором.
   *
   * @param dto - Данные для создания пользователя.
   * @returns DTO созданного пользователя (без пароля).
   * @throws {ConflictException} Если email или username уже заняты.
   * @throws {BadRequestException} Если указанная роль не существует.
   */
  async createUser(dto: CreateUserAdminDto): Promise<UserAdminResponseDto> {
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException("Email already registered");
    }

    if (dto.username) {
      const existingUsername = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (existingUsername) {
        throw new ConflictException(
          `Username "${dto.username}" is already taken`,
        );
      }
    }

    const roleSlug = dto.role ?? SystemRole.USER;
    const role = await this.prisma.role.findUnique({
      where: { slug: roleSlug },
    });
    if (!role) {
      throw new BadRequestException(`Role "${roleSlug}" not found`);
    }

    const passwordHash = await this.hashPassword(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          roleId: role.id,
          username: dto.username,
          displayName: dto.displayName,
          isActive: dto.isActive ?? true,
        },
        select: USER_ADMIN_SELECT,
      });

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role?.slug ?? SystemRole.USER,
        isActive: user.isActive,
        deactivatedAt: user.deactivatedAt,
        avatarUrl: user.avatarUrl,
        telegramUsername: user.telegramUsername,
        gitUrl: user.gitUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      // TODO улучшить проверку
      if (
        (error instanceof Error && "code" in error && error.code === "P2002") ||
        (typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code: unknown }).code === "P2002")
      ) {
        const target = (error as { meta?: { target?: string[] | string } }).meta
          ?.target;

        const targetStr = Array.isArray(target)
          ? target.join(",")
          : (target ?? "");

        if (targetStr.includes("username")) {
          throw new ConflictException(
            dto.username
              ? `Username "${dto.username}" is already taken`
              : "Username is already taken",
          );
        }

        if (targetStr.includes("email")) {
          throw new ConflictException("Email already registered");
        }

        throw new ConflictException("Email or username already registered");
      }
      throw error;
    }
  }

  /**
   * Обновляет данные и роль пользователя.
   * При смене роли автоматически отзывает все активные сессии пользователя.
   *
   * @param id - UUID пользователя.
   * @param dto - Поля для обновления.
   * @returns DTO обновленного пользователя.
   * @throws {NotFoundException} Если пользователь не найден.
   * @throws {ConflictException} Если новый email или username уже заняты.
   * @throws {BadRequestException} Если указанная роль не существует.
   */
  async updateUser(
    id: string,
    dto: UpdateUserAdminDto,
  ): Promise<UserAdminResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });

    if (!existing) {
      throw new NotFoundException("User not found");
    }

    if (dto.email && dto.email !== existing.email) {
      const emailConflict = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (emailConflict && emailConflict.id !== id) {
        throw new ConflictException("Email already registered");
      }
    }

    if (dto.username && dto.username !== existing.username) {
      const usernameConflict = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (usernameConflict && usernameConflict.id !== id) {
        throw new ConflictException(
          `Username "${dto.username}" is already taken`,
        );
      }
    }

    let newRoleId: string | undefined;
    let roleChanged = false;

    if (dto.role) {
      const targetRole = await this.prisma.role.findUnique({
        where: { slug: dto.role },
      });
      if (!targetRole) {
        throw new BadRequestException(`Role "${dto.role}" not found`);
      }
      newRoleId = targetRole.id;
      const currentRoleSlug = existing.role?.slug;
      if (
        currentRoleSlug
          ? currentRoleSlug !== targetRole.slug
          : existing.roleId !== targetRole.id
      ) {
        roleChanged = true;
      }
    }

    let taskId: string | undefined;
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id },
          data: {
            ...(dto.email !== undefined && { email: dto.email }),
            ...(dto.displayName !== undefined && {
              displayName: dto.displayName,
            }),
            ...(dto.username !== undefined && { username: dto.username }),
            ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
            ...(dto.telegramUsername !== undefined && {
              telegramUsername: dto.telegramUsername,
            }),
            ...(dto.gitUrl !== undefined && { gitUrl: dto.gitUrl }),
            ...(newRoleId !== undefined && { roleId: newRoleId }),
          },
          select: USER_ADMIN_SELECT,
        });

        let taskCreatedAt: Date | undefined;
        if (roleChanged) {
          const task = await tx.authRevocationTask.create({
            data: { userId: id },
          });
          taskId = task.id;
          taskCreatedAt = task.createdAt;
        }

        return { user, taskCreatedAt };
      });

      if (roleChanged) {
        try {
          await this.revokeSessionsWithRetry(id, updated.taskCreatedAt);
          if (taskId) {
            await this.prisma.authRevocationTask
              .delete({ where: { id: taskId } })
              .catch(() => undefined);
          }
        } catch (error) {
          this.logger.error(
            `Failed to revoke sessions / publish revocation for user ${id} during updateUser (persisted for worker retry)`,
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      const user = updated.user;
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role?.slug ?? SystemRole.USER,
        isActive: user.isActive,
        deactivatedAt: user.deactivatedAt,
        avatarUrl: user.avatarUrl,
        telegramUsername: user.telegramUsername,
        gitUrl: user.gitUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      if (
        (error instanceof Error && "code" in error && error.code === "P2002") ||
        (typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code: unknown }).code === "P2002")
      ) {
        const target = (error as { meta?: { target?: string[] | string } }).meta
          ?.target;
        const targetStr = Array.isArray(target)
          ? target.join(",")
          : (target ?? "");
        if (targetStr.includes("username")) {
          throw new ConflictException(
            dto.username
              ? `Username "${dto.username}" is already taken`
              : "Username is already taken",
          );
        }
        if (targetStr.includes("email")) {
          throw new ConflictException("Email already registered");
        }
        throw new ConflictException("Email or username already registered");
      }
      throw error;
    }
  }

  /**
   * Изменяет статус активности пользователя (активация / деактивация).
   * Включает защиту от блокировки самого себя.
   * При деактивации мгновенно отзывает все сессии пользователя в Redis.
   *
   * @param id - UUID целевого пользователя.
   * @param dto - DTO с флагом `isActive`.
   * @param currentAdminId - UUID текущего авторизованного администратора.
   * @returns DTO обновленного пользователя.
   * @throws {BadRequestException} Если администратор пытается деактивировать сам себя.
   * @throws {NotFoundException} Если пользователь не найден.
   */
  async updateStatus(
    id: string,
    dto: UserStatusAdminDto,
    currentAdminId: string,
  ): Promise<UserAdminResponseDto> {
    if (id === currentAdminId && !dto.isActive) {
      throw new BadRequestException(
        "Cannot deactivate own administrator account",
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException("User not found");
    }

    const deactivatedAt = dto.isActive ? null : new Date();

    let taskId: string | undefined;
    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          isActive: dto.isActive,
          deactivatedAt,
        },
        select: USER_ADMIN_SELECT,
      });

      let taskCreatedAt: Date | undefined;
      if (!dto.isActive) {
        const task = await tx.authRevocationTask.create({
          data: { userId: id },
        });
        taskId = task.id;
        taskCreatedAt = task.createdAt;
      }

      return { user, taskCreatedAt };
    });

    if (!dto.isActive) {
      try {
        await this.revokeSessionsWithRetry(id, updated.taskCreatedAt);
        if (taskId) {
          await this.prisma.authRevocationTask
            .delete({ where: { id: taskId } })
            .catch(() => undefined);
        }
      } catch (error) {
        this.logger.error(
          `Failed to revoke sessions / publish revocation for user ${id} during updateStatus (persisted for worker retry)`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    const user = updated.user;
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role?.slug ?? SystemRole.USER,
      isActive: user.isActive,
      deactivatedAt: user.deactivatedAt,
      avatarUrl: user.avatarUrl,
      telegramUsername: user.telegramUsername,
      gitUrl: user.gitUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Отзывает все активные сессии пользователя с повторными попытками.
   */
  private async revokeSessionsWithRetry(
    userId: string,
    maxCreatedAt?: Date | string,
    retries = 3,
    delayMs = 50,
  ): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.authSessionService.revokeAllUserSessions(
          userId,
          maxCreatedAt,
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
   * Хеширует пароль через Argon2id с параметрами конфигурации.
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
}
