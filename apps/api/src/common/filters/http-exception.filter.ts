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
  message: string | string[] | Record<string, string>;
  error?: string;
}

/** Утверждает, что `value` — непустой объект-словарь (не `null`, не массив). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Определяет тело ошибки валидации: объект `{ field: message }` без
 * служебных ключей `statusCode`/`message`/`error` (так бросает
 * `ZodValidationPipe`). Такие тела прокидываются клиенту как есть.
 */
function isFieldErrorMap(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) {
    return false;
  }
  const keys = Object.keys(value);
  if (
    keys.length === 0 ||
    "statusCode" in value ||
    "message" in value ||
    "error" in value
  ) {
    return false;
  }
  return keys.every((key) => typeof value[key] === "string");
}

/**
 * Глобальный фильтр исключений.
 *
 * Обрабатывает `HttpException` (возвращает санитизированное тело
 * `{ statusCode, message, error }`; для ошибок валидации `message`
 * содержит карту `{ field: message }`) и маскирует необработанные ошибки
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

  /**
   * Приводит тело `HttpException` к санитизированному `HttpErrorBody`.
   *
   * @param status - HTTP-статус исключения.
   * @param exceptionResponse - Исходное тело исключения (строка или объект).
   * @returns Нормализованное тело ответа без внутренних деталей.
   */
  private toHttpErrorBody(
    status: number,
    exceptionResponse: unknown,
  ): HttpErrorBody {
    if (typeof exceptionResponse === "string") {
      return { statusCode: status, message: exceptionResponse };
    }

    // ZodValidationPipe: BadRequestException({ field: message }) —
    // прокидываем карту ошибок полей без маскировки (§47, §63 SPEC.md).
    if (isFieldErrorMap(exceptionResponse)) {
      return { statusCode: status, message: exceptionResponse };
    }

    if (!isRecord(exceptionResponse)) {
      return { statusCode: status, message: "Unknown error" };
    }

    const message = exceptionResponse.message ?? "Unknown error";
    const error =
      typeof exceptionResponse.error === "string"
        ? exceptionResponse.error
        : undefined;

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
