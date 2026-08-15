import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/**
 * Глобальный модуль Prisma.
 *
 * Экспортирует `PrismaService` для всех модулей приложения без повторного
 * импорта `PrismaModule`.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
