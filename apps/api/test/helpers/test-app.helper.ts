import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../../src/app.module";
import { configureApp } from "../../src/main";
import { PrismaService } from "../../src/prisma/prisma.service";
import { RedisService } from "../../src/redis/redis.service";

/** Дескриптор запущенного тестового приложения. */
export interface StartedApp {
  app: INestApplication;
  prisma: PrismaService;
  redis: RedisService;
}

/**
 * Запускает приложение на реальных PG+Redis (Docker) без слушателя порта.
 *
 * HTTP-конфигурация идентична production (`configureApp` из `main.ts`);
 * запросы выполняются через supertest на `app.getHttpServer()`.
 *
 * @returns Дескриптор приложения для последующего `stopTestApp`.
 */
export async function startTestApp(
  controllers?: (new (...args: unknown[]) => unknown)[],
): Promise<StartedApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: controllers || [],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    redis: app.get(RedisService),
  };
}

/**
 * Мок Redis-методов для имитации недоступного Redis.
 *
 * Индекс не задаётся: набор методов выводится из прототипа `RedisService`.
 */
export type RedisMock = Record<string, jest.Mock>;

/**
 * Хуки жизненного цикла, которые вызывает сам Nest.
 *
 * Их нельзя превращать в отказ: подмена провайдера не должна мешать `app.init()`
 * подняться, иначе приложение не стартует вовсе и тест проверяет не отказ
 * Redis, а невозможность загрузки модуля.
 */
const LIFECYCLE_HOOKS = new Set([
  "onModuleInit",
  "onModuleDestroy",
  "onApplicationShutdown",
]);

/**
 * Собирает `RedisService`, у которого любая операция отказывает как при
 * недоступном Redis.
 *
 * Методы берутся из прототипа `RedisService` намеренно. Ручной список однажды
 * разошёлся с сервисом: `AuthSessionService.createSession` пишет сессию
 * скриптом `eval`, которого в моке не было, поэтому регистрация падала с
 * `TypeError: this.redisService.eval is not a function` — тем же `catch`, что и
 * настоящий отказ Redis, и тот же `500`, то есть все проверки ответа проходили
 * по неверной причине, а `redisMock.set` не вызывался никогда.
 *
 * @returns Мок, у которого каждый метод — `jest.fn`, отклоняющийся с
 * `connect ECONNREFUSED`.
 */
function createRedisDownMock(): RedisMock {
  const prototype = RedisService.prototype as unknown as object;
  const mock: RedisMock = {};

  for (const name of Object.getOwnPropertyNames(prototype)) {
    if (name === "constructor" || LIFECYCLE_HOOKS.has(name)) {
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    if (typeof descriptor?.value !== "function") {
      continue;
    }
    mock[name] = jest.fn().mockRejectedValue(new Error("connect ECONNREFUSED"));
  }

  return mock;
}

/**
 * Суммарное число обращений к Redis за время теста.
 *
 * Нужно вместо проверки конкретного метода: конкретный метод — деталь
 * реализации (`createSession` сегодня пишет скриптом `eval`, завтра может
 * перейти на `set`), а проверять надо факт «Redis был запрошен и отказал».
 *
 * @param mock - Мок из `startTestAppWithRedisDown`.
 * @returns Число вызовов всех методов мока.
 */
export function countRedisCalls(mock: RedisMock): number {
  return Object.values(mock).reduce(
    (sum, method) => sum + method.mock.calls.length,
    0,
  );
}

/** Мок `RedisService`, эмулирующий недоступный Redis (§48 SPEC.md). */
export interface RedisDownHandles {
  app: INestApplication;
  prisma: PrismaService;
  redisMock: RedisMock;
}

/**
 * Запускает приложение с переопределённым `RedisService`: все операции
 * реджектятся как при недоступном Redis. PostgreSQL остаётся реальным —
 * компенсация (удаление user) выполняется по-настоящему.
 *
 * @returns Дескриптор приложения и мок Redis-операций.
 */
export async function startTestAppWithRedisDown(): Promise<RedisDownHandles> {
  const redisMock = createRedisDownMock();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(RedisService)
    .useValue(redisMock)
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return { app, prisma: app.get(PrismaService), redisMock };
}

/**
 * Корректно останавливает тестовое приложение (shutdown hooks закрывают PG).
 *
 * @param started - Объект с полем `app` из `startTestApp*`.
 */
export async function stopTestApp(started: {
  app: INestApplication;
}): Promise<void> {
  await started.app.close();
}

/**
 * Генерирует уникальный email для изоляции прогонов e2e.
 *
 * @param domain - Домен тестовых email.
 * @returns Уникальный email в нижнем регистре.
 */
export function uniqueEmail(domain = "e2e.test"): string {
  return `${randomUUID()}@${domain}`;
}
