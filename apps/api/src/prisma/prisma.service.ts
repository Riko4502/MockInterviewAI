import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: value import required for NestJS DI metadata
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

/**
 * Сервис доступа к базе данных PostgreSQL через Prisma Client.
 *
 * Зарегистрирован в глобальном модуле `PrismaModule` — доступен через DI
 * без импорта модуля. Клиент подключён через driver adapter `@prisma/adapter-pg`
 * (Prisma 7), URL базы данных берётся из конфигурации (`database.url`).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * @param configService - Конфигурация приложения (секция `database.url`).
   */
  constructor(configService: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: configService.get<string>("database.url"),
      }),
    });
  }

  /** Устанавливает соединение с базой данных при инициализации модуля. */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /** Закрывает соединение с базой данных при завершении работы модуля. */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
