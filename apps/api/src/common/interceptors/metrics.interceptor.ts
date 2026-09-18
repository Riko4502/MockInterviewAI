import {
  type CallHandler,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { catchError, finalize, type Observable, throwError } from "rxjs";

import { MetricsService } from "../metrics/metrics.service";

/**
 * Глобальный интерцептор сбора HTTP-метрик в Prometheus.
 *
 * Фиксирует активные запросы, длительность обработки и счётчики по
 * методу/маршруту/status code. Маршрут берётся из `request.route?.path`
 * (именованный шаблон вместо конкретных id), чтобы не плодить кардинальность
 * лейблов на каждый url.
 *
 * Статус исключения фиксируется в `catchError`: finalize выполняется при
 * teardown потока до того, как глобальный HttpExceptionFilter вызовет
 * `response.status(...)`, поэтому на момент finalize `response.statusCode` ещё
 * содержит значение по умолчанию (200) — статусы исключений попадали бы в 200.
 * Для успешного потока статус читается из `response.statusCode` на момент
 * finalize: хендлер мог установить его через `@Res()`/`res.status(...)` уже
 * после старта запроса.
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
    let errorStatusCode: number | undefined;

    this.metricsService.requestStarted();

    return next.handle().pipe(
      catchError((error: unknown) => {
        errorStatusCode =
          error instanceof HttpException
            ? error.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;
        return throwError(() => error);
      }),
      finalize(() => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        const statusCode = errorStatusCode ?? response.statusCode;
        this.metricsService.requestFinished(
          { method, route, statusCode },
          durationMs,
        );
      }),
    );
  }
}
