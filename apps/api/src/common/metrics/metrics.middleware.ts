import { type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import { MetricsService } from "./metrics.service";

/**
 * Глобальный HTTP-учёт метрик Prometheus (SPEC.md, §8).
 *
 * Работает как middleware, а не interceptor: NestJS выполняет guards
 * (AccessTokenGuard/RolesGuard/OriginCheckGuard, AuthThrottlerGuard) раньше
 * interceptors, поэтому отклонённые ими запросы (401/403/429) не попадали бы
 * в http_requests_total / nestjs_active_requests. Middleware срабатывает до
 * guards и учитывает все запросы.
 *
 * Маршрут достаётся из `req.route?.path` в обработчике `finish`: на момент
 * входа в middleware роутер ещё не выполнил matching, а к моменту завершения
 * ответа Express уже заполнил `req.route`.
 */
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const method = req.method;
    const start = process.hrtime.bigint();

    this.metricsService.requestStarted();

    let settled = false;
    const settle = () => {
      if (settled) {
        return;
      }
      settled = true;
      res.off("finish", settle);
      res.off("close", settle);

      const route = req.route?.path ?? "unmatched";
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      this.metricsService.requestFinished(
        { method, route, statusCode: res.statusCode },
        durationMs,
      );
    };

    res.on("finish", settle);
    res.on("close", settle);

    next();
  }
}
