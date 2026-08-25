import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { type Observable, tap } from "rxjs";

/**
 * Глобальный интерцептор логирования HTTP-запросов.
 *
 * Логирует URL, HTTP-метод, status code и latency (мс).
 * Не логирует тело запроса и чувствительные данные (§46, §56 SPEC.md):
 * `password`, `passwordHash`, `accessToken`, `refreshToken`,
 * `refreshTokenHash`, JWT secrets, Redis credentials, полный `Authorization` header.
 */
@Injectable()
export class SensitiveLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SensitiveLoggingInterceptor.name);

  /**
   * Перехватывает запрос, фиксирует время начала и логирует результат
   * после завершения обработки.
   *
   * @param context - Контекст выполнения (ExecutionContext).
   * @param next - Следующий обработчик в цепочке.
   * @returns Observable с логированием после ответа.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const latency = Date.now() - start;
        this.logger.log(`${method} ${url} ${latency}ms`);
      }),
    );
  }
}
