import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { publishUserRevocation } from "../../../common/pubsub/revocation";
import { PrismaService } from "../../../prisma/prisma.service";
import { RedisService } from "../../../redis/redis.service";
import { AuthSessionService } from "./auth-session.service";

/** Redis-ключ распределенного лока для защиты от параллельного запуска крона ревокации */
const REVOCATION_CRON_LOCK_KEY = "lock:cron:session-revocation";
/** Время жизни лока в секундах */
const REVOCATION_CRON_LOCK_TTL_SECONDS = 30;
/** Размер пакета задач для обработки за одну итерацию */
const BATCH_SIZE = 50;

/**
 * Фоновый воркер повторной обработки незавершённых сессионных ревокаций.
 *
 * Обрабатывает задачи из таблицы `auth_revocation_tasks`, созданные при смене пароля
 * (например, через `resetPassword`), в случае если Redis был недоступен в момент запроса.
 */
@Injectable()
export class SessionRevocationCron {
  private readonly logger = new Logger(SessionRevocationCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly sessionService: AuthSessionService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron(): Promise<number> {
    const lockAcquired = await this.redisService
      .setNx(
        REVOCATION_CRON_LOCK_KEY,
        new Date().toISOString(),
        REVOCATION_CRON_LOCK_TTL_SECONDS,
      )
      .catch(() => false);

    if (!lockAcquired) {
      return 0;
    }

    try {
      return await this.processPendingRevocations();
    } catch (err) {
      this.logger.error(
        `Error during session revocation cron execution: ${String(err)}`,
      );
      return 0;
    } finally {
      await this.redisService
        .delete(REVOCATION_CRON_LOCK_KEY)
        .catch(() => undefined);
    }
  }

  async processPendingRevocations(): Promise<number> {
    const tasks = await this.prisma.authRevocationTask.findMany({
      take: BATCH_SIZE,
      orderBy: { createdAt: "asc" },
    });

    if (tasks.length === 0) {
      return 0;
    }

    let processedCount = 0;

    for (const task of tasks) {
      try {
        await this.sessionService.revokeAllUserSessions(task.userId);
        await publishUserRevocation(this.redisService, task.userId);
        await this.prisma.authRevocationTask.delete({
          where: { id: task.id },
        });
        processedCount++;
      } catch (err) {
        this.logger.warn(
          `Failed to process durable revocation task ${task.id} for user ${task.userId}: ${String(err)}`,
        );
      }
    }

    return processedCount;
  }
}
