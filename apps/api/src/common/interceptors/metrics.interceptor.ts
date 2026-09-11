import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { finalize, type Observable } from "rxjs";

import { MetricsService } from "../metrics/metrics.service";

/**
 * Глобальный интерцептор сбора HTTP-метрик в Prometheus.
 *
 * Фиксирует активные запросы, длительность обработки и счётчики по
 * методу/маршруту/status code. Маршрут берётся из `request.route?.path`
 * (именованный шаблон вместо конкретных id), чтобы не плодить кардинальность
 * лейблов на каждый url.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method } = request;
    const route = request.route?.path ?? "unmatched";
    const start = process.hrtime.bigint();

    this.metricsService.requestStarted();

    return next.handle().pipe(
      finalize(() => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        this.metricsService.requestFinished(
          { method, route, statusCode: response.statusCode },
          durationMs,
        );
      }),
    );
  }
}
