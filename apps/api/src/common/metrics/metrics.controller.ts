import { Controller, Get, Header, HttpCode, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Response } from "express";

import { Public } from "../decorators/public.decorator";
import { MetricsService } from "./metrics.service";

/**
 * Экспортирует метрики приложения в текстовом формате Prometheus (SPEC.md, §6).
 *
 * Эндпоинт отдаётся без аутентификации: он используется прометеус-скрейпером
 * из Docker-сети. Доступ снаружи должен закрываться на уровне обратного прокси
 * (nginx) — сами метрики не содержат чувствительных данных.
 */
@ApiExcludeController()
@Controller("metrics")
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Public()
  @HttpCode(200)
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  @Header("Cache-Control", "no-store")
  async metrics(
    @Res({ passthrough: true }) _response: Response,
  ): Promise<string> {
    return this.metricsService.metrics();
  }
}
