-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegramLinkVerified" BOOLEAN NOT NULL DEFAULT false;
