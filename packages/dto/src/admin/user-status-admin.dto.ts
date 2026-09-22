import { z } from "zod";

/**
 * Zod-схема изменения статуса активности пользователя.
 */
export const userStatusAdminSchema = z.object({
  isActive: z.boolean(),
});

/**
 * DTO изменения статуса активности пользователя.
 */
export type UserStatusAdminDto = z.infer<typeof userStatusAdminSchema>;
