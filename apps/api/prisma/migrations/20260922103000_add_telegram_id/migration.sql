-- prisma-execute-no-transaction
-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegramId" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "users_telegramId_key" ON "users"("telegramId");
