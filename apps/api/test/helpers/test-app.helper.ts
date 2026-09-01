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
export async function startTestApp(): Promise<StartedApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
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

/** Мок Redis-методов для имитации недоступного Redis. */
export interface RedisMock {
  set: jest.Mock;
  get: jest.Mock;
  delete: jest.Mock;
  expire: jest.Mock;
  ping: jest.Mock;
  scanKeys: jest.Mock;
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
  const redisMock = {
    set: jest.fn().mockRejectedValue(new Error("connect ECONNREFUSED")),
    get: jest.fn().mockRejectedValue(new Error("connect ECONNREFUSED")),
    delete: jest.fn().mockRejectedValue(new Error("connect ECONNREFUSED")),
    expire: jest.fn().mockRejectedValue(new Error("connect ECONNREFUSED")),
    ping: jest.fn().mockRejectedValue(new Error("connect ECONNREFUSED")),
    scanKeys: jest.fn().mockRejectedValue(new Error("connect ECONNREFUSED")),
  };

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
