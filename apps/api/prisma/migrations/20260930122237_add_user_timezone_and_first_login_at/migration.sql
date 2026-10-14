-- AlterTable
ALTER TABLE "users" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow';
ALTER TABLE "users" ADD COLUMN "firstLoginAt" TIMESTAMP(3);
