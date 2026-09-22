-- prisma-execute-no-transaction
-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_id" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "users_telegram_id_key" ON "users"("telegram_id");
