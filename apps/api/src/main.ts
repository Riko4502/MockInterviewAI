import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { SensitiveLoggingInterceptor } from "./common/interceptors/sensitive-logging.interceptor";

/**
 * Точка входа приложения.
 *
 * Настраивает глобальный prefix `/api/v1`, helmet, cookie-parser,
 * CORS с explicit origin и credentials, глобальный `HttpExceptionFilter`,
 * глобальный `SensitiveLoggingInterceptor` (§46 SPEC.md) и shutdown hooks
 * для корректного закрытия соединений Prisma.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
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

  await app.listen(config.get<number>("port") ?? 3001);
}

void bootstrap();
