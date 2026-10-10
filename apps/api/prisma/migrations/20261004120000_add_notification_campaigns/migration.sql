-- CreateEnum
CREATE TYPE "NotificationCampaignAudience" AS ENUM ('ALL', 'SPECIFIC');

-- CreateEnum
CREATE TYPE "NotificationCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "campaign_id" UUID;

-- CreateTable
CREATE TABLE "notification_campaigns" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "category" "NotificationType" NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "action_url" TEXT,
    "audience" "NotificationCampaignAudience" NOT NULL,
    "recipient_ids" UUID[] NOT NULL,
    "status" "NotificationCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "processing_started_at" TIMESTAMP(3),
    "creator_id" UUID,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_id" UUID,
    "cancellation_reason" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_campaign_id_idx" ON "notifications"("campaign_id");
CREATE UNIQUE INDEX "notifications_campaign_id_userId_key" ON "notifications"("campaign_id", "userId");
CREATE INDEX "notification_campaigns_status_scheduled_at_idx" ON "notification_campaigns"("status", "scheduled_at");
CREATE INDEX "notification_campaigns_creator_id_created_at_idx" ON "notification_campaigns"("creator_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "notification_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_campaigns" ADD CONSTRAINT "notification_campaigns_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_campaigns" ADD CONSTRAINT "notification_campaigns_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
