import { getTimeZoneRejection } from "@packages/utils";
import { z } from "zod";

/**
 * Валидация IANA-таймзоны пользователя (ADR-002:47-52).
 *
 * Шаг «формат → резолвимость» обязателен именно в таком порядке: начиная с
 * ES2024 `Intl.DateTimeFormat` принимает offset-формы (`+04:00`, `-0730`), и
 * без шага с форматом в `User.timezone` записался бы фиксированный сдвиг.
 * Проверка живёт в `@packages/utils`, потому что правило одно и то же и для
 * API, и для клиентского рендера.
 *
 * Алиасы (`Europe/Kiev`, `Asia/Calcutta`) намеренно не нормализуются: значение
 * сохраняется как прислано и резолвится ICU по актуальным правилам (ADR-002:52).
 */
export const timeZoneSchema = z
  .string()
  .trim()
  .refine((value) => getTimeZoneRejection(value) === null, {
    error: "Укажите корректную IANA-таймзону, например Europe/Moscow",
  });
