import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configureApp } from "./configure-app";

export { configureApp } from "./configure-app";

/**
 * Создаёт и конфигурирует приложение без запуска слушателя.
 *
 * @returns Инициализированное приложение (требуется `await app.init()`/`listen()`).
 */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  return app;
}

/**
 * Точка входа приложения.
 *
 * Создаёт приложение через `createApp()` и слушает порт из конфигурации;
 * shutdown hooks обеспечивают корректное закрытие соединений Prisma.
 * Выполняется только при прямом запуске модуля — импорт `main.ts`
 * (e2e-тесты) не поднимает HTTP-сервер.
 */
async function bootstrap(): Promise<void> {
  const app = await createApp();
  const config = app.get(ConfigService);
  await app.listen(config.get<number>("port") ?? 3001);
}

if (require.main === module) {
  void bootstrap();
}
