import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../../prisma/prisma.service";
import { RedisService } from "../../../redis/redis.service";
import { StorageService } from "../../storage/storage.service";

/** Redis-ключ распределенного лока для защиты от параллельного запуска на нескольких репликах */
const CLEANUP_LOCK_KEY = "lock:cron:user-cleanup";
/** Время жизни лока в секундах (1 час) */
const CLEANUP_LOCK_TTL_SECONDS = 3600;
/** Размер пакета пользователей для обработки */
const BATCH_SIZE = 100;
/** 30 дней в миллисекундах */
const RETENTION_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Фоновый воркер очистки аккаунтов.
 *
 * Запускается раз в сутки в полночь, находит деактивированные аккаунты с истекшим
 * сроком восстановления (deletedAt > 30 дней), удаляет их аватары из S3 и окончательно
 * удаляет запись из базы данных.
 */
@Injectable()
export class UserCleanupCron {
  private readonly logger = new Logger(UserCleanupCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Ежесуточный запуск в полночь.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron(): Promise<number> {
    // 1. Захват Distributed Lock в Redis
    const lockAcquired = await this.redisService.setNx(
      CLEANUP_LOCK_KEY,
      new Date().toISOString(),
      CLEANUP_LOCK_TTL_SECONDS,
    );

    if (!lockAcquired) {
      this.logger.debug(
        "User cleanup cron job is already running on another instance, skipping...",
      );
      return 0;
    }

    this.logger.log(
      "Starting daily cleanup for expired deactivated accounts (>30 days)...",
    );

    try {
      const purgedCount = await this.purgeExpiredAccounts();
      this.logger.log(
        `Cleanup completed successfully. Total purged accounts: ${purgedCount}`,
      );
      return purgedCount;
    } catch (err) {
      this.logger.error(
        `Error during user cleanup cron execution: ${String(err)}`,
      );
      return 0;
    } finally {
      // Освобождаем лок
      await this.redisService.delete(CLEANUP_LOCK_KEY);
    }
  }

  /**
   * Пакетная очистка просроченных аккаунтов.
   *
   * @returns Количество окончательно удаленных аккаунтов.
   */
  async purgeExpiredAccounts(): Promise<number> {
    const thresholdDate = new Date(Date.now() - RETENTION_PERIOD_MS);
    let totalPurged = 0;

    while (true) {
      const expiredUsers = await this.prisma.user.findMany({
        where: {
          deletedAt: {
            not: null,
            lt: thresholdDate,
          },
        },
        take: BATCH_SIZE,
        select: {
          id: true,
          avatarUrl: true,
        },
      });

      if (expiredUsers.length === 0) {
        break;
      }

      for (const user of expiredUsers) {
        try {
          // Удаляем аватар из S3 (если был)
          if (user.avatarUrl) {
            await this.storageService.deleteFile(user.avatarUrl);
          }

          // Окончательно удаляем пользователя из БД
          await this.prisma.user.delete({
            where: { id: user.id },
          });

          totalPurged++;
        } catch (err) {
          this.logger.error(
            `Failed to purge expired user ${user.id}: ${String(err)}`,
          );
        }
      }
    }

    return totalPurged;
  }
}
