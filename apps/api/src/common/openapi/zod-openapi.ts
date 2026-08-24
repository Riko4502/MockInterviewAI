import { applyDecorators } from "@nestjs/common";
import type { SchemaObject } from "@nestjs/swagger";
import { ApiBody } from "@nestjs/swagger";
import { z } from "zod";

/**
 * Конвертирует zod-схему в OpenAPI `SchemaObject` (§61 SPEC.md).
 *
 * Используется нативный `z.toJSONSchema()` (zod v4) в режиме `io: "input"` —
 * описывается контракт *входящего* запроса. Шаги `.transform()` (например,
 * нормализация email) непредставимы в JSON Schema и в этом режиме
 * корректно пропускаются. Служебное поле `$schema` удаляется — OpenAPI
 * определяет собственный диалект.
 *
 * @param schema - Zod-схема DTO.
 * @returns Схема для документации (`ApiBody`, `ApiResponse`).
 */
export function zodToSchemaObject(schema: z.ZodType): SchemaObject {
  const jsonSchema = z.toJSONSchema(schema, {
    io: "input",
  }) as Record<string, unknown>;

  delete jsonSchema.$schema;

  return jsonSchema as SchemaObject;
}

/**
 * Декоратор тела запроса из zod-схемы (§61 SPEC.md).
 *
 * Единственный источник схемы DTO — `@packages/dto`; при изменении схем
 * документация обновляется автоматически, ручного дублирования нет.
 *
 * @param schema - Zod-схема тела запроса.
 * @returns Комбинированный декоратор Swagger для метода контроллера.
 */
export function ZodBody(schema: z.ZodType): MethodDecorator {
  return applyDecorators(
    ApiBody({
      description: "Тело запроса, валидируется соответствующей zod-схемой.",
      schema: zodToSchemaObject(schema),
    }),
  );
}
