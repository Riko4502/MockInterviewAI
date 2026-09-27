import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import Redis from "ioredis";
import { PrismaClient } from "../generated/prisma/client";
import { InterviewSessionStatus } from "../generated/prisma/enums";
import { sessionInviteKey } from "../modules/sessions/session-keys";

config({ path: resolve(__dirname, "..", "..", "..", ".env") });

/**
 * Application-level backfill скрипт для сохранения legacy-токенов в Postgres.
 *
 * Считывает существующий инвайт-токен из sessionInviteKey в Redis для сессий со
 * статусом ACTIVE и записывает его в Postgres. Если ключ в Redis уже истёк,
 * старый токен восстановить невозможно — такие сессии пропускаются.
 *
 * Использование:
 *   pnpm --filter api backfill:invite-tokens
 */
async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error(
      "Error: DATABASE_URL environment variable is not set.\n" +
        "Please provide a valid DATABASE_URL before running backfill:invite-tokens.",
    );
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    console.log("[backfill-tokens] Соединение с Redis и Postgres установлено.");

    const BATCH_SIZE = 50;
    let cursor: string | undefined;
    let hasMore = true;
    let total = 0;
    let updated = 0;
    let expired = 0;

    while (hasMore) {
      const sessions = await prisma.interviewSession.findMany({
        where: {
          status: InterviewSessionStatus.ACTIVE,
          inviteToken: null,
        },
        select: { id: true, inviteToken: true },
        take: BATCH_SIZE,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { id: "asc" },
      });

      if (sessions.length === 0) {
        break;
      }

      cursor = sessions[sessions.length - 1].id;
      if (sessions.length < BATCH_SIZE) {
        hasMore = false;
      }

      for (const session of sessions) {
        total++;
        const key = sessionInviteKey(session.id);
        const redisToken = await redis.get(key);

        if (redisToken && redisToken.trim().length > 0) {
          await prisma.interviewSession.update({
            where: { id: session.id },
            data: { inviteToken: redisToken.trim() },
          });
          updated++;
          console.log(
            `[backfill-tokens] Сессия ${session.id}: legacy-токен сохранён в Postgres.`,
          );
        } else {
          expired++;
          console.warn(
            `[backfill-tokens] Сессия ${session.id}: ключ в Redis истёк, старый токен восстановить нельзя (потребуется новая ссылка).`,
          );
        }
      }
    }

    console.log(
      `\n[backfill-tokens] Миграция токенов завершена: ` +
        `Всего сессий: ${total}, Сохранено: ${updated}, Истекших ключей: ${expired}`,
    );
  } finally {
    await redis.quit().catch(() => redis.disconnect());
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[backfill-tokens] Фатальная ошибка миграции:", err);
    process.exit(1);
  });
}
