import { resolve } from "node:path";
import { PermissionSlugs, SystemPermission, SystemRole } from "@packages/types";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";
import { config } from "dotenv";
import Redis from "ioredis";
import { PrismaClient } from "../generated/prisma/client";

config({ path: resolve(__dirname, "..", "..", "..", ".env") });

/**
 * CLI-скрипт назначения роли системного администратора (ADMIN).
 *
 * Использование:
 *   pnpm --filter api seed:admin -- --email admin@mockinterview.tech
 *   pnpm --filter api seed:admin -- --email newadmin@mockinterview.tech --password "SuperSecret123!"
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let email: string | undefined;
  let password: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) {
      email = args[i + 1].trim().toLowerCase();
      i++;
    } else if (args[i] === "--password" && args[i + 1]) {
      password = args[i + 1];
      i++;
    }
  }

  if (!email) {
    console.error(
      "Ошибка: укажите email администратора через --email <email>\n" +
        "Пример: pnpm --filter api seed:admin -- --email admin@mockinterview.tech",
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error(
      "Error: DATABASE_URL environment variable is not set.\n" +
        "Please provide a valid DATABASE_URL before running seed-admin.",
    );
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    // 1. Убеждаемся, что системные роли существуют
    const adminRole = await prisma.role.upsert({
      where: { slug: SystemRole.ADMIN },
      create: {
        id: "00000000-0000-4000-a000-000000000001",
        slug: SystemRole.ADMIN,
        name: "Администратор",
        description: "Системный администратор платформы",
        permissions: SystemPermission.ADMINISTRATOR,
        isSystem: true,
      },
      update: {
        permissions: SystemPermission.ADMINISTRATOR,
      },
    });

    await prisma.role.upsert({
      where: { slug: SystemRole.USER },
      create: {
        id: "00000000-0000-4000-a000-000000000002",
        slug: SystemRole.USER,
        name: "Пользователь",
        description: "Обычный пользователь платформы",
        permissions: SystemPermission.NONE,
        isSystem: true,
      },
      update: {},
    });

    // 2. Инициализируем справочник permissions
    for (const [bitStr, slug] of Object.entries(PermissionSlugs)) {
      const bitValue = BigInt(bitStr);
      await prisma.permission.upsert({
        where: { slug },
        create: {
          slug,
          name: slug,
          bitValue,
        },
        update: {
          bitValue,
        },
      });
    }

    // 3. Ищем или создаем пользователя
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    let targetUserId: string;

    if (existingUser) {
      targetUserId = existingUser.id;
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { roleId: adminRole.id },
      });
      console.log(
        `[seed-admin] Пользователь ${email} (id: ${existingUser.id}) успешно повышен до роли ${SystemRole.ADMIN}!`,
      );
    } else {
      if (!password) {
        throw new Error(
          "Password is required to create a new administrator (--password)",
        );
      }
      const userPassword = password;
      const passwordHash = await argon2.hash(userPassword, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });

      const newUser = await prisma.user.create({
        data: {
          email,
          passwordHash,
          roleId: adminRole.id,
        },
      });
      targetUserId = newUser.id;
      console.log(
        `[seed-admin] Создан новый администратор: ${email} (id: ${newUser.id})`,
      );
    }

    // 4. Инвалидируем сессии в Redis для мгновенного обновления JWT claims
    let redis: Redis | null = null;
    try {
      redis = new Redis({
        host: process.env.REDIS_HOST || "localhost",
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        lazyConnect: true,
      });
      await redis.connect();

      if (targetUserId) {
        const stream = redis.scanStream({
          match: "auth:session:*",
          count: 100,
        });

        for await (const chunk of stream) {
          const keys = chunk as string[];
          for (const key of keys) {
            const val = await redis.get(key);
            if (val) {
              try {
                const session = JSON.parse(val);
                if (session.userId === targetUserId) {
                  await redis.del(key);
                }
              } catch {
                // Ignore malformed session JSON
              }
            }
          }
        }
        console.log(
          `[seed-admin] Активные сессии пользователя сброшены для немедленного перелогина.`,
        );
      }
    } catch {
      console.warn(
        `[seed-admin] Redis недоступен для сброса сессий, обновление применится при следующем логине.`,
      );
    } finally {
      if (redis) {
        try {
          await redis.quit();
        } catch {
          redis.disconnect();
        }
      }
    }

    console.log("[seed-admin] Готово!");
  } catch (error) {
    console.error("[seed-admin] Ошибка выполнения:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
