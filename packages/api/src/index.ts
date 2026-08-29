/**
 * @packages/api — сгенерированный API-клиент из OpenAPI спецификации.
 *
 * ## Использование
 *
 * После генерации:
 * ```ts
 * import type { paths, components } from "@packages/api";
 *
 * type SessionDto = components["schemas"]["SessionDto"];
 * ```
 *
 * ## Генерация
 *
 * ```bash
 * pnpm --filter @packages/api generate
 * ```
 *
 * ## Важно
 *
 * - Ручное изменение `src/generated.ts` запрещено.
 * - После генерации запустить `pnpm typecheck` во всём проекте.
 */

export type * from "./generated";
