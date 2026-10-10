import { z } from "zod";
import { notificationTypeSchema } from "./notification.dto";

export const notificationCampaignStatusSchema = z.enum([
  "DRAFT",
  "SCHEDULED",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
]);
export const notificationTargetTypeSchema = z.enum(["ALL", "SPECIFIC"]);
export const notificationCampaignSendModeSchema = z.enum([
  "SCHEDULED",
  "DRAFT",
]);

const recipientUserIdsSchema = z
  .array(z.uuid())
  .max(1000)
  .transform((ids) => [...new Set(ids)]);
const actionUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) =>
      (value.startsWith("/") && !value.startsWith("//")) ||
      (() => {
        try {
          return new URL(value).protocol === "https:";
        } catch {
          return false;
        }
      })(),
    "actionUrl must be a relative path or HTTPS URL",
  );

export const createNotificationCampaignSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(2000),
    category: notificationTypeSchema,
    actionUrl: actionUrlSchema.optional(),
    targetType: notificationTargetTypeSchema,
    recipientUserIds: recipientUserIdsSchema.optional(),
    sendMode: notificationCampaignSendModeSchema,
    scheduledAt: z.iso.datetime().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.targetType === "SPECIFIC" &&
      (!value.recipientUserIds || value.recipientUserIds.length === 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["recipientUserIds"],
        message: "Select at least one recipient",
      });
    }
    if (value.targetType === "ALL" && value.recipientUserIds?.length) {
      context.addIssue({
        code: "custom",
        path: ["recipientUserIds"],
        message: "recipientUserIds must be empty for ALL",
      });
    }
    if (value.scheduledAt && Date.parse(value.scheduledAt) < Date.now()) {
      context.addIssue({
        code: "custom",
        path: ["scheduledAt"],
        message: "scheduledAt must not be in the past",
      });
    }
  });
export type CreateNotificationCampaignDto = z.infer<
  typeof createNotificationCampaignSchema
>;

export const updateNotificationCampaignSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    message: z.string().trim().min(1).max(2000).optional(),
    category: notificationTypeSchema.optional(),
    actionUrl: actionUrlSchema.nullable().optional(),
    targetType: notificationTargetTypeSchema.optional(),
    recipientUserIds: recipientUserIdsSchema.optional(),
    scheduledAt: z.iso.datetime().optional(),
  })
  .superRefine((value, context) => {
    if (value.scheduledAt && Date.parse(value.scheduledAt) < Date.now()) {
      context.addIssue({
        code: "custom",
        path: ["scheduledAt"],
        message: "scheduledAt must not be in the past",
      });
    }
  });
export type UpdateNotificationCampaignDto = z.infer<
  typeof updateNotificationCampaignSchema
>;

export const notificationCampaignSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  message: z.string(),
  category: notificationTypeSchema,
  actionUrl: z.string().nullable(),
  targetType: notificationTargetTypeSchema,
  status: notificationCampaignStatusSchema,
  scheduledAt: z.iso.datetime().nullable(),
  sentAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  totalRecipients: z.number().int().nonnegative(),
  sentCount: z.number().int().nonnegative(),
  readCount: z.number().int().nonnegative(),
  lastProcessedUserId: z.uuid().nullable(),
  failureReason: z.string().nullable(),
  createdById: z.uuid().nullable(),
  creator: z
    .object({
      id: z.uuid(),
      displayName: z.string().nullable(),
      email: z.email(),
    })
    .nullable(),
  cancelledById: z.uuid().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  cancellationReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type NotificationCampaignDto = z.infer<
  typeof notificationCampaignSchema
>;

export const notificationCampaignDetailsSchema =
  notificationCampaignSchema.extend({
    recipientUserIds: z.array(z.uuid()),
  });
export type NotificationCampaignDetailsDto = z.infer<
  typeof notificationCampaignDetailsSchema
>;
export type NotificationCampaignStatus = z.infer<
  typeof notificationCampaignStatusSchema
>;
export type NotificationTargetType = z.infer<
  typeof notificationTargetTypeSchema
>;
export type NotificationCampaignSendMode = z.infer<
  typeof notificationCampaignSendModeSchema
>;

export const notificationCampaignsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: notificationCampaignStatusSchema.optional(),
  targetType: notificationTargetTypeSchema.optional(),
  sortBy: z.enum(["createdAt", "scheduledAt", "sentAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
export type NotificationCampaignsQueryDto = z.infer<
  typeof notificationCampaignsQuerySchema
>;

export const notificationCampaignsPageSchema = z.object({
  items: z.array(notificationCampaignSchema),
  meta: z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(100),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});
export type NotificationCampaignsPageDto = z.infer<
  typeof notificationCampaignsPageSchema
>;

export const notificationCampaignCancelSchema = z
  .object({
    reason: z.string().trim().nullable().optional(),
  })
  .optional();
export type NotificationCampaignCancelDto = z.infer<
  typeof notificationCampaignCancelSchema
>;
export const notificationCampaignRecipientEstimateSchema = z.object({
  count: z.number().int().nonnegative(),
});
export type NotificationCampaignRecipientEstimateDto = z.infer<
  typeof notificationCampaignRecipientEstimateSchema
>;
