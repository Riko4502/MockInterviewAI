import { z } from "zod";

export const newNotificationSchema = z.object({
  type: z.literal("notification.new"),
  payload: z.object({
    id: z.string().min(1),
    title: z.string(),
    message: z.string(),
    actionUrl: z.string().nullish(),
    // The API always sends both fields, but apps/realtime replays
    // stream history by Last-Event-ID and the stream is retained for
    // 7 days, so a payload without them can still reach the client.
    // Invalid events are dropped silently in production, so the client
    // must not reject a record it is merely replaying.
    createdAt: z.iso.datetime().nullish(),
    read: z.boolean().nullish(),
  }),
});
export const badgeSchema = z.object({
  type: z.literal("notification.badge"),
  payload: z.object({ unreadCount: z.number().int().nonnegative() }),
});
