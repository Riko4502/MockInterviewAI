import { Injectable } from "@nestjs/common";
import type { User } from "../../generated/prisma/client";
// biome-ignore lint/style/useImportType: value import required for NestJS DI metadata
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Сервис управления пользователями (§9, §10 SPEC.md).
 *
 * Предоставляет поиск по email и создание пользователя.
 * Работает с уже захешированным паролем — хеширование
 * является ответственностью вызывающего модуля (AuthService).
 */
@Injectable()
export class UsersService {
  /**
   * @param prisma - Глобальный `PrismaService` для доступа к PostgreSQL.
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ищет пользователя по email.
   *
   * @param email - Нормализованный email (lowercase).
   * @returns Объект пользователя или `null`, если не найден.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * Создаёт нового пользователя.
   *
   * @param data - Обязательные поля: `email` (нормализованный), `passwordHash` (Argon2id).
   * @returns Созданный объект пользователя.
   * @throws {Prisma.PrismaClientKnownRequestError} При нарушении уникальности email (P2002).
   */
  async create(data: { email: string; passwordHash: string }): Promise<User> {
    return this.prisma.user.create({ data });
  }
}
