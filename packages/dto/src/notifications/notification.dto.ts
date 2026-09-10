import { z } from "zod";

export const notificationTypeSchema = z.enum([
  "SYSTEM",
  "INTERVIEW",
  "MESSAGE",
]);

export const notificationSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  category: notificationTypeSchema,
  title: z.string(),
  message: z.string(),
  actionUrl: z.string().nullable(),
  readAt: z.iso.datetime().nullable(),
  deletedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type NotificationDto = z.infer<typeof notificationSchema>;

export const notificationsListSchema = z.object({
  items: z.array(notificationSchema),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export type NotificationsListDto = z.infer<typeof notificationsListSchema>;

export const unreadNotificationsCountSchema = z.object({
  count: z.number().int().nonnegative(),
});

export type UnreadNotificationsCountDto = z.infer<
  typeof unreadNotificationsCountSchema
>;

export const notificationActionResponseSchema = z.object({
  success: z.boolean(),
});

export type NotificationActionResponseDto = z.infer<
  typeof notificationActionResponseSchema
>;
