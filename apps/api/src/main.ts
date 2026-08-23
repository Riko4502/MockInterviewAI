import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { SensitiveLoggingInterceptor } from "./common/interceptors/sensitive-logging.interceptor";

/**
 * Применяет HTTP-конфигурацию приложения (§2, §42 SPEC.md).
 *
 * Глобальный prefix `/api/v1`, helmet, cookie-parser, CORS с explicit origin
 * и credentials, глобальный `HttpExceptionFilter`, глобальный
 * `SensitiveLoggingInterceptor` (§46 SPEC.md). Используется и bootstrap'ом,
 * и e2e-тестами — единая конфигурация HTTP layer.
 *
 * @param app - Экземпляр Nest-приложения.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  app.setGlobalPrefix(config.get<string>("apiPrefix") ?? "/api/v1");
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string[]>("allowedOrigins"),
    credentials: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new SensitiveLoggingInterceptor());
  app.enableShutdownHooks();
}

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
