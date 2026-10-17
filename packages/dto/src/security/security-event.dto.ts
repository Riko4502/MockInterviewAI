import { z } from "zod";

/**
 * Тип security-события в публичном DTO.
 *
 * Значения повторяют enum БД `SecurityEventType` (ADR-005:93). Список
 * продублирован намеренно: `packages/dto` не импортирует Prisma-клиент, и
 * расширение enum в схеме обязано осознанно попасть в контракт API.
 */
export const securityEventTypeSchema = z.enum([
  "ACCOUNT_REGISTERED",
  "FIRST_LOGIN",
  "PASSWORD_CHANGED",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_RESET_COMPLETED",
  "LOGIN_FROM_NEW_DEVICE",
  "TG_LINKED",
  "TG_UNLINKED",
  "GITHUB_LINKED",
  "GITHUB_UNLINKED",
  "PROFILE_CHANGED",
  "ACCOUNT_DEACTIVATED",
  "ACCOUNT_RESTORED",
]);

export type SecurityEventTypeDto = z.infer<typeof securityEventTypeSchema>;

/**
 * Публичное представление security-события для in-app-фолбэка (D8).
 *
 * `ipAddress`/`userAgent` в DTO отсутствуют намеренно: ADR-005:128 запрещает
 * их вынос в любой публичный DTO. `metadata` вернулось бы каналом утечки,
 * поэтому оно тоже не отдаётся.
 */
export const securityEventSchema = z.object({
  id: z.uuid(),
  type: securityEventTypeSchema,
  createdAt: z.iso.datetime(),
});

export type SecurityEventDto = z.infer<typeof securityEventSchema>;

/** Список непросмотренных security-событий (компенсирующий in-app-канал). */
export const unseenSecurityEventsResponseSchema = z.object({
  items: z.array(securityEventSchema),
});

export type UnseenSecurityEventsResponseDto = z.infer<
  typeof unseenSecurityEventsResponseSchema
>;

/** Отметка события «просмотрено». */
export const markSecurityEventSeenResponseSchema = z.object({
  success: z.literal(true),
});

export type MarkSecurityEventSeenResponseDto = z.infer<
  typeof markSecurityEventSeenResponseSchema
>;
