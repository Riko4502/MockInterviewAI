ALTER TYPE "NotificationCampaignAudience" RENAME TO "NotificationTargetType";
ALTER TABLE "notification_campaigns" RENAME COLUMN "audience" TO "target_type";
ALTER TABLE "notification_campaigns" ADD COLUMN "completed_at" TIMESTAMP(3),
  ADD COLUMN "total_recipients" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "sent_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_processed_user_id" UUID;

CREATE TABLE "notification_campaign_recipients" (
  "id" UUID NOT NULL,
  "campaign_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_campaign_recipients_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "notification_campaign_recipients_campaign_id_user_id_key"
  ON "notification_campaign_recipients"("campaign_id", "user_id");
CREATE INDEX "notification_campaign_recipients_user_id_idx"
  ON "notification_campaign_recipients"("user_id");

INSERT INTO "notification_campaign_recipients" ("id", "campaign_id", "user_id")
SELECT gen_random_uuid(), c."id", r."user_id"
FROM "notification_campaigns" c
CROSS JOIN LATERAL unnest(c."recipient_ids") AS r("user_id")
WHERE c."target_type" = 'SPECIFIC';

UPDATE "notification_campaigns" c
SET "total_recipients" = CASE
  WHEN c."target_type" = 'SPECIFIC' THEN cardinality(c."recipient_ids")
  ELSE (SELECT count(*)::integer FROM "users" u WHERE u."isActive" = true AND u."deletedAt" IS NULL)
END,
"sent_count" = (SELECT count(*)::integer FROM "notifications" n WHERE n."campaign_id" = c."id");
ALTER TABLE "notification_campaigns" DROP COLUMN "recipient_ids";

ALTER TABLE "notification_campaign_recipients"
  ADD CONSTRAINT "notification_campaign_recipients_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "notification_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "notification_campaign_recipients_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications" DROP CONSTRAINT "notifications_campaign_id_fkey";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "notification_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
