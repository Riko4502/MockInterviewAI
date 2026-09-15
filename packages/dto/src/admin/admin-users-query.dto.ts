import { z } from "zod";

/**
 * Допустимые поля для сортировки списка пользователей администратором.
 */
export const adminUsersSortBySchema = z.enum([
  "createdAt",
  "email",
  "username",
  "displayName",
  "role",
  "updatedAt",
]);

export type AdminUsersSortBy = z.infer<typeof adminUsersSortBySchema>;

/**
 * Направление сортировки.
 */
export const adminUsersSortOrderSchema = z.enum(["asc", "desc"]);

export type AdminUsersSortOrder = z.infer<typeof adminUsersSortOrderSchema>;

/**
 * Zod-схема валидации query-параметров списка пользователей для администратора.
 */
export const adminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  role: z.string().trim().optional(),
  isActive: z
    .preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
  sortBy: adminUsersSortBySchema.default("createdAt"),
  sortOrder: adminUsersSortOrderSchema.default("desc"),
});

/**
 * DTO query-параметров списка пользователей администратора.
 */
export type AdminUsersQueryDto = z.infer<typeof adminUsersQuerySchema>;
