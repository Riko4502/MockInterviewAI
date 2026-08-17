import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

interface HttpErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}

/**
 * Глобальный фильтр исключений.
 *
 * Обрабатывает `HttpException` (возвращает санитизированное тело
 * `{ statusCode, message, error }`) и маскирует необработанные ошибки
 * (Prisma, Redis, прочее) до `500 Internal server error` без внутренних
 * деталей в любом окружении (§47, §56 SPEC.md).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  /**
   * Обрабатывает перехваченное исключение и формирует HTTP-ответ.
   *
   * @param exception - Перехваченное исключение.
   * @param host - Контекст выполнения (для получения HTTP-ответа).
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      response
        .status(status)
        .json(this.toHttpErrorBody(status, exceptionResponse));
      return;
    }

    this.logger.error(
      "Unhandled exception",
      exception instanceof Error ? exception.stack : String(exception),
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
      error: "Internal Server Error",
    });
  }

  private toHttpErrorBody(
    status: number,
    exceptionResponse: unknown,
  ): HttpErrorBody {
    if (typeof exceptionResponse === "string") {
      return { statusCode: status, message: exceptionResponse };
    }

    const record = exceptionResponse as Record<string, unknown>;
    const message = record.message ?? "Unknown error";
    const error = typeof record.error === "string" ? record.error : undefined;

    return {
      statusCode: status,
      message:
        typeof message === "string" || Array.isArray(message)
          ? message
          : "Unknown error",
      ...(error ? { error } : {}),
    };
  }
}
