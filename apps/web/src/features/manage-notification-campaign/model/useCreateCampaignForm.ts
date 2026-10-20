import { useCallback } from "react";
import { z } from "zod";

const campaignFormSchema = z
  .object({
    title: z.string().trim().min(1, "title").max(200, "title"),
    message: z.string().trim().min(1, "message").max(2000, "message"),
    actionUrl: z
      .string()
      .refine(
        (url) => !url || /^\/(?!\/)/.test(url) || /^https:\/\//i.test(url),
        "url",
      ),
    target: z
      .string()
      .refine((target) => target === "ALL" || target === "SPECIFIC"),
    recipientCount: z.number().int().nonnegative(),
    sendMode: z.enum(["DRAFT", "SCHEDULED"]),
    sendNow: z.boolean(),
    scheduledAt: z.string(),
  })
  .superRefine((values, context) => {
    if (
      values.target === "SPECIFIC" &&
      (values.recipientCount < 1 || values.recipientCount > 1000)
    ) {
      context.addIssue({
        code: "custom",
        path: ["recipientCount"],
        message: "recipients",
      });
    }
    if (
      values.sendMode === "SCHEDULED" &&
      !values.sendNow &&
      (!values.scheduledAt ||
        new Date(values.scheduledAt).getTime() <= Date.now())
    ) {
      context.addIssue({
        code: "custom",
        path: ["scheduledAt"],
        message: "scheduledAt",
      });
    }
  });

export type CreateCampaignFormValues = z.input<typeof campaignFormSchema>;

export function useCreateCampaignForm() {
  return useCallback((values: CreateCampaignFormValues) => {
    const result = campaignFormSchema.safeParse(values);
    return result.success
      ? []
      : Array.from(new Set(result.error.issues.map((issue) => issue.message)));
  }, []);
}
