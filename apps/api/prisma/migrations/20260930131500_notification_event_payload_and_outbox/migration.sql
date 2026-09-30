-- CreateEnum
CREATE TYPE "NotificationOutboxStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- ADR-003:96 makes `SELECT count(*) FROM notifications` a mandatory release
-- step, and this migration drops `title` and `message` without a backfill.
-- The check is enforced here rather than only in the runbook: the columns
-- hold the only copy of the rendered text, so a non-empty table would lose it
-- irreversibly. Failing loudly is the intended outcome, not a fallback.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "notifications" LIMIT 1) THEN
        RAISE EXCEPTION
            'notifications is not empty: migration would drop title and message without a backfill. '
            'ADR-003:96 requires stopping the release and adding a backfill into type/payload first.';
    END IF;
END $$;

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "message",
DROP COLUMN "title",
ADD COLUMN     "dedupKey" TEXT,
ADD COLUMN     "payload" JSONB NOT NULL,
ADD COLUMN     "renderedMessage" TEXT,
ADD COLUMN     "renderedTitle" TEXT,
ADD COLUMN     "type" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "notification_outbox" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "recipientId" UUID NOT NULL,
    "category" "NotificationType" NOT NULL,
    "actionUrl" TEXT,
    "status" "NotificationOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_outbox_status_nextAttemptAt_idx" ON "notification_outbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupKey_key" ON "notifications"("dedupKey");
