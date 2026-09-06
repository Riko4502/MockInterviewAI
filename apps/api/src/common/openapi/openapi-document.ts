import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { OpenAPIObject } from "@nestjs/swagger";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { getSchemaRegistry } from "./zod-openapi";

const API_VERSION = "0.1.0";

/**
 * Строит OpenAPI-документ всего приложения (§61 SPEC.md).
 *
 * Общая точка сборки для UI на `/docs` (dev-режим) и скрипта генерации
 * `apps/api/openapi/openapi.{yaml,json}` — метаданные не дублируются.
 *
 * @param app - Инициализированное приложение (роуты должны быть зарегистрированы).
 * @returns Готовый OpenAPI-документ.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const configService = app.get(ConfigService);
  const port = configService.get<number>("port") ?? 3001;

  const config = new DocumentBuilder()
    .setTitle("Mock Interview AI API")
    .setDescription(
      [
        "Auth API: register, login, logout.",
        "",
        "Refresh token передаётся только через HttpOnly cookie",
        "(HttpOnly; SameSite=Lax; Path=/api/v1/auth; Max-Age=JWT_REFRESH_EXPIRATION)",
        "и не возвращается в JSON response.",
      ].join("\n"),
    )
    .setVersion(API_VERSION)
    .addBearerAuth()
    .addServer(`http://localhost:${port}`)
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.components = document.components ?? {};
  document.components.schemas = document.components.schemas ?? {};

  for (const [name, schema] of getSchemaRegistry().entries()) {
    document.components.schemas[name] = schema;
  }

  return document;
}
