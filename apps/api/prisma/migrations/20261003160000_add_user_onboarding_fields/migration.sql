-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_completed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "target_role" "Specialization";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "target_level" "ExperienceLevel";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "target_companies" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "target_timeline" VARCHAR(50);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferred_format" VARCHAR(50);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_onboarding_completed_idx" ON "users"("onboarding_completed");

-- Backfill existing users so they are not forced into onboarding
UPDATE "users" SET "onboarding_completed" = true WHERE "createdAt" <= NOW();
