import {
  type ArgumentMetadata,
  BadRequestException,
  type PipeTransform,
} from "@nestjs/common";

/** Формат ошибки валидации: поле → сообщение. */
type ZodErrorField = Record<string, string>;

/** Минимальный интерфейс zod-схемы для валидации через pipe. */
interface ZodSchema {
  safeParse: (value: unknown) =>
    | { success: true; data: unknown }
    | {
        success: false;
        error: {
          issues: Array<{ path: ReadonlyArray<PropertyKey>; message: string }>;
        };
      };
}

/**
 * NestJS-pipe валидации DTO через Zod-схему.
 *
 * Использует `safeParse` (§6 SPEC.md) — при ошибке выбрасывает
 * `BadRequestException` (400) с объектом `{ field: message }`.
 *
 * Применяется per-route: `@Body(new ZodValidationPipe(schema))`.
 *
 * @example
 * ```ts
 * @Post('register')
 * register(@Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto) {}
 * ```
 */
export class ZodValidationPipe implements PipeTransform {
  /**
   * @param schema - Zod-схема для валидации DTO.
   */
  constructor(private readonly schema: ZodSchema) {}

  /**
   * Валидирует входные данные по Zod-схеме.
   *
   * @param value - Входное значение (request body, query, param).
   * @param metadata - Метаданные параметра (не используется).
   * @returns Валидированные и нормализованные данные.
   * @throws {BadRequestException} Если валидация не прошла (400).
   */
  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }

    const fields = this.formatError(result.error);
    throw new BadRequestException(fields);
  }

  /**
   * Форматирует ошибку Zod в объект `{ field: message }`.
   *
   * @param error - Ошибка Zod.
   * @returns Объект с полями и сообщениями ошибок.
   */
  private formatError(error: {
    issues: Array<{ path: ReadonlyArray<PropertyKey>; message: string }>;
  }): ZodErrorField {
    const fields: ZodErrorField = {};
    for (const issue of error.issues) {
      const field = issue.path.join(".");
      fields[field || "_root"] = issue.message;
    }
    return fields;
  }
}
