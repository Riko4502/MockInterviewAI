import { Controller, Get, HttpStatus, Logger, Res } from "@nestjs/common";
import type { SchemaObject } from "@nestjs/swagger";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { registerSchema } from "../../common/openapi/zod-openapi";
import { PrismaService } from "../../prisma/prisma.service";

interface HealthResponse {
  status: "ok" | "error";
  db: "up" | "down";
}

const HEALTH_RESPONSE_SCHEMA: SchemaObject = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["ok", "error"] },
    db: { type: "string", enum: ["up", "down"] },
  },
  required: ["status", "db"],
};

/**
 * Контроллер проверки состояния приложения (§56 SPEC.md).
 *
 * `GET /api/v1/health` доступен без auth; внутренние детали в ответ не попадают.
 */
@ApiTags("health")
@Controller("health")
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  /**
   * @param prisma - Глобальный `PrismaService` для ping PostgreSQL.
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Проверяет доступность базы данных PostgreSQL.
   *
   * Успех: `200 { status: "ok", db: "up" }`. Ошибка БД: `503
   * { status: "error", db: "down" }` без внутренних деталей (реальная ошибка
   * только в логах).
   *
   * @param response - HTTP-ответ Express для установки статуса 503.
   * @returns Объект статуса с состоянием базы данных.
   */
  @Get()
  @Public()
  @ApiOperation({ summary: "Проверка состояния приложения (§56)" })
  @ApiResponse({
    status: 200,
    description: "Приложение и PostgreSQL доступны.",
    schema: registerSchema("HealthResponseDto", HEALTH_RESPONSE_SCHEMA),
  })
  @ApiResponse({
    status: 503,
    description: "PostgreSQL недоступен. Детали ошибки только в логах (§56).",
    schema: { $ref: "#/components/schemas/HealthResponseDto" },
  })
  async check(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", db: "up" };
    } catch (error) {
      this.logger.error(
        "Health check failed",
        error instanceof Error ? error.message : String(error),
      );
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: "error", db: "down" };
    }
  }
}
