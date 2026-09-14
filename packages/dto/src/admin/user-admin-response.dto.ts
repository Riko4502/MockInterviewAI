import { z } from "zod";

/**
 * Zod-схема метаданных пагинации.
 */
export const paginationMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export type PaginationMetaDto = z.infer<typeof paginationMetaSchema>;

/**
 * Zod-схема ответа администратора с данными пользователя (строго без passwordHash).
 */
export const userAdminResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  role: z.string(),
  isActive: z.boolean(),
  deactivatedAt: z.date().or(z.string()).nullable(),
  avatarUrl: z.string().nullable(),
  telegramUsername: z.string().nullable(),
  gitUrl: z.string().nullable(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});

export type UserAdminResponseDto = z.infer<typeof userAdminResponseSchema>;

/**
 * Zod-схема детального ответа администратора с расширенной статистикой сессий.
 */
export const userAdminDetailResponseSchema = userAdminResponseSchema.extend({
  sessionsCount: z.number().int().nonnegative(),
  participationsCount: z.number().int().nonnegative(),
});

export type UserAdminDetailResponseDto = z.infer<
  typeof userAdminDetailResponseSchema
>;

/**
 * Zod-схема пагинированного ответа списка пользователей для администратора.
 */
export const paginatedUsersAdminResponseSchema = z.object({
  items: z.array(userAdminResponseSchema),
  meta: paginationMetaSchema,
});

export type PaginatedUsersAdminResponseDto = z.infer<
  typeof paginatedUsersAdminResponseSchema
>;
