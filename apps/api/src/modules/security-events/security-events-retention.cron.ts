import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import {
  SECURITY_EVENT_RETENTION_BATCH_SIZE,
  SECURITY_EVENT_RETENTION_MS,
} from "./security-events.constants";

/** Redis-ключ распределённого лока: на нескольких репликах чистит только одна. */
const RETENTION_LOCK_KEY = "lock:cron:security-events-retention";

/** TTL лока — час: проход дольше этого означал бы зависание, и лок отпустится сам. */
const RETENTION_LOCK_TTL_SECONDS = 3600;

/**
 * Ретенция security-событий (ADR-005:126, plan D12).
 *
 * События хранятся 12 месяцев, после чего удаляются — вместе с `ipAddress` и
 * `userAgent`, из-за которых их и нельзя держать дольше (ADR-005:128). Удаление
 * пакетное: один `deleteMany` на всю таблицу держал бы блокировку и раздувал
 * WAL.
 *
 * Это единственное место, где событие удаляется по возрасту. Soft-delete
 * пользователя (`User.deletedAt`) события не трогает — они доживают до
 * окончательного затирания аккаунта в `user-cleanup.cron.ts` (ADR-005:125).
 */
@Injectable()
export class SecurityEventsRetentionCron {
  private readonly logger = new Logger(SecurityEventsRetentionCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpired(): Promise<void> {
    if (process.env.NODE_ENV === "test") {
      return;
    }

    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      return;
    }

    try {
      const threshold = new Date(Date.now() - SECURITY_EVENT_RETENTION_MS);
      let deletedTotal = 0;

      for (;;) {
        const expired = await this.prisma.securityEvent.findMany({
          where: { createdAt: { lt: threshold } },
          select: { id: true },
          take: SECURITY_EVENT_RETENTION_BATCH_SIZE,
        });

        if (expired.length === 0) {
          break;
        }

        const result = await this.prisma.securityEvent.deleteMany({
          where: { id: { in: expired.map((event) => event.id) } },
        });
        deletedTotal += result.count;

        if (expired.length < SECURITY_EVENT_RETENTION_BATCH_SIZE) {
          break;
        }
      }

      if (deletedTotal > 0) {
        this.logger.log(
          `Security event retention removed ${deletedTotal} events older than 12 months`,
        );
      }
    } catch (error) {
      this.logger.error(
        "Failed to purge expired security events",
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      await this.redisService.delete(RETENTION_LOCK_KEY).catch(() => undefined);
    }
  }

  private async acquireLock(): Promise<boolean> {
    try {
      return await this.redisService.setNx(
        RETENTION_LOCK_KEY,
        "1",
        RETENTION_LOCK_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.error(
        "Redis unavailable, skipping security event retention",
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }
}
