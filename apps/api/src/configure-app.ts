import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { SensitiveLoggingInterceptor } from "./common/interceptors/sensitive-logging.interceptor";
import { buildOpenApiDocument } from "./common/openapi/openapi-document";

/**
 * Применяет HTTP-конфигурацию приложения (§2, §42, §61 SPEC.md).
 *
 * Глобальный prefix `/api/v1`, helmet, cookie-parser, CORS с explicit origin
 * и credentials, глобальный `HttpExceptionFilter`, глобальный
 * `SensitiveLoggingInterceptor` (§46 SPEC.md). Вне production дополнительно
 * поднимается Swagger UI на `/docs` (JSON — `/docs-json`); в этом режиме
 * helmet отключает CSP, чтобы Swagger UI загружал свои скрипты.
 *
 * Используется и bootstrap'ом, и e2e-тестами — единая конфигурация HTTP layer.
 *
 * @param app - Экземпляр Nest-приложения.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const isProduction = config.get<string>("env") === "production";

  app.setGlobalPrefix(config.get<string>("apiPrefix") ?? "/api/v1");
  app.use(
    helmet(
      isProduction
        ? undefined
        : {
            contentSecurityPolicy: {
              directives: {
                defaultSrc: ["'self'"],
                baseUri: ["'self'"],
                objectSrc: ["'none'"],
                frameAncestors: ["'self'"],
                imgSrc: ["'self'", "data:"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
              },
            },
          },
    ),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string[]>("allowedOrigins"),
    credentials: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new SensitiveLoggingInterceptor());

  if (!isProduction) {
    SwaggerModule.setup("docs", app, buildOpenApiDocument(app));
  }

  app.enableShutdownHooks();
}
