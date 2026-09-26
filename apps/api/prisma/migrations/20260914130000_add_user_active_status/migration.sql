-- AlterTable: users add isActive and deactivatedAt
ALTER TABLE "users" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "deactivatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX CONCURRENTLY "users_isActive_idx" ON "users"("isActive");
CREATE INDEX CONCURRENTLY "users_createdAt_idx" ON "users"("createdAt");
