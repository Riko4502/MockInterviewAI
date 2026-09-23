import { z } from "zod";

export const newNotificationSchema = z.object({
  type: z.literal("notification.new"),
  payload: z.object({
    id: z.string().min(1),
    title: z.string(),
    message: z.string(),
    actionUrl: z.string().nullish(),
  }),
});
export const badgeSchema = z.object({
  type: z.literal("notification.badge"),
  payload: z.object({ unreadCount: z.number().int().nonnegative() }),
});
