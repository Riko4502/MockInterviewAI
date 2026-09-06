import { applyDecorators } from "@nestjs/common";
import type { ReferenceObject, SchemaObject } from "@nestjs/swagger";
import { ApiBody } from "@nestjs/swagger";
import { z } from "zod";

/**
 * Определяет, что узел zod-дерева — `z.email()` (в том числе на выходе
 * `.pipe(z.email())`). Используется для восстановления `format: "email"`
 * в OpenAPI-схеме: режим `io: "input"` переносит email-проверку pipe
 * на output-сторону и JSON Schema её теряет.
 */
function isZodEmail(node: unknown): boolean {
  if (node instanceof z.ZodEmail) {
    return true;
  }
  // Fallback по имени класса — защита от дубликатов инстансов zod
  // в workspace-монорепе (разные физические копии пакета).
  return (
    (node as { constructor?: { name?: string } } | undefined)?.constructor
      ?.name === "ZodEmail"
  );
}

/**
 * Ищет `ZodEmail` где угодно в поддереве схемы (обе стороны pipe:
 * `.in` и `.out`, любая вложенность).
 */
function containsZodEmail(node: unknown, depth = 0): boolean {
  if (!node || typeof node !== "object" || depth > 10) {
    return false;
  }
  if (isZodEmail(node)) {
    return true;
  }
  const composite = node as { in?: unknown; out?: unknown };
  return (
    containsZodEmail(composite.in, depth + 1) ||
    containsZodEmail(composite.out, depth + 1)
  );
}

function defInputOf(node: unknown): unknown {
  return (
    (node as { in?: unknown }).in ??
    (node as { _zod?: { def?: { in?: unknown } } })._zod?.def?.in
  );
}

/**
 * Возвращает shape объектной схемы, раскручивая обёртки `.refine()` /
 * `.transform()` (в zod v4 корень превращается в pipe — `shape`
 * доступен только на input-стороне).
 */
function resolveShape(node: unknown, maxDepth = 5): Record<string, unknown> {
  let current: unknown = node;
  for (let depth = 0; depth < maxDepth && current; depth++) {
    const shape = (current as { shape?: Record<string, unknown> }).shape;
    if (shape) {
      return shape;
    }
    current = defInputOf(current);
  }
  return {};
}

/**
 * Проставляет `format: "email"` в сконвертированной схеме для полей,
 * исходный zod-тип которых — `z.email()` (см. {@link isZodEmail}).
 */
function injectEmailFormats(
  jsonSchema: { properties?: Record<string, SchemaObject> },
  shape: Record<string, unknown>,
): void {
  if (!jsonSchema.properties) {
    return;
  }
  for (const [key, propertySchema] of Object.entries(shape)) {
    if (containsZodEmail(propertySchema) && jsonSchema.properties[key]) {
      jsonSchema.properties[key].format = "email";
    }
  }
}

/**
 * Конвертирует zod-схему в OpenAPI `SchemaObject` (§61 SPEC.md).
 *
 * Используется нативный `z.toJSONSchema()` (zod v4) в режиме `io: "input"` —
 * описывается контракт *входящего* запроса. Шаги `.transform()` (например,
 * нормализация email или удаление `passwordConfirmation`) непредставимы
 * в JSON Schema и в этом режиме корректно пропускаются. Служебное поле
 * `$schema` удаляется — OpenAPI определяет собственный диалект.
 *
 * Для полей на базе `z.email()` восстанавливается `format: "email"`,
 * который pipe-обёртка в input-режиме не экспортирует.
 *
 * @param schema - Zod-схема DTO.
 * @returns Схема для документации (`ApiBody`, `ApiResponse`).
 */
export function zodToSchemaObject(schema: z.ZodType): SchemaObject {
  const jsonSchema = z.toJSONSchema(schema, {
    target: "openapi-3.0",
    io: "input",
    unrepresentable: "any",
  }) as Record<string, unknown>;

  delete jsonSchema.$schema;

  const shape = resolveShape(schema);
  if (Object.keys(shape).length > 0) {
    injectEmailFormats(
      jsonSchema as { properties?: Record<string, SchemaObject> },
      shape,
    );
  }

  return jsonSchema as SchemaObject;
}

/**
 * Реестр именованных схем для OpenAPI components.schemas.
 */
const schemaRegistry = new Map<string, SchemaObject>();

/**
 * Регистрирует схему под именем в реестре `components.schemas`
 * и возвращает `$ref` объект на неё.
 */
export function registerSchema(
  name: string,
  schemaOrObject: z.ZodType | SchemaObject,
): ReferenceObject {
  const isZod =
    schemaOrObject instanceof z.ZodType ||
    typeof (schemaOrObject as { safeParse?: unknown })?.safeParse ===
      "function" ||
    (schemaOrObject as { _def?: unknown })?._def !== undefined;

  const schemaObj = isZod
    ? zodToSchemaObject(schemaOrObject as z.ZodType)
    : (schemaOrObject as SchemaObject);

  schemaRegistry.set(name, schemaObj);

  return {
    $ref: `#/components/schemas/${name}`,
  };
}

/**
 * Возвращает накопленный реестр схем для внедрения в OpenAPI Document.
 */
export function getSchemaRegistry(): Map<string, SchemaObject> {
  return schemaRegistry;
}

/**
 * Декоратор тела запроса из zod-схемы (§61 SPEC.md).
 *
 * Единственный источник схемы DTO — `@packages/dto`; при изменении схем
 * документация обновляется автоматически, ручного дублирования нет.
 *
 * @param schema - Zod-схема тела запроса.
 * @param name - Опциональное имя схемы для регистрации в components.schemas.
 * @returns Комбинированный декоратор Swagger для метода контроллера.
 */
export function ZodBody(schema: z.ZodType, name?: string): MethodDecorator {
  const schemaObj = name
    ? registerSchema(name, schema)
    : zodToSchemaObject(schema);
  return applyDecorators(
    ApiBody({
      description: "Тело запроса, валидируется соответствующей zod-схемой.",
      schema: schemaObj,
    }),
  );
}
