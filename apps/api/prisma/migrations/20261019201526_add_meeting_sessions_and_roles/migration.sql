/*
  Warnings:

  - You are about to alter the column `slug` on the `permissions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(64)`.
  - You are about to alter the column `name` on the `permissions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `slug` on the `roles` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(64)`.
  - You are about to alter the column `name` on the `roles` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - A unique constraint covering the columns `[invite_token]` on the table `interview_sessions` will be added. If there are existing duplicate values, this will fail.
  - Made the column `invite_token` on table `interview_sessions` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "InterviewSessionType" AS ENUM ('CODE', 'MEETING');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InterviewParticipantRole" ADD VALUE 'HOST';
ALTER TYPE "InterviewParticipantRole" ADD VALUE 'PARTICIPANT';

-- DropIndex
DROP INDEX "users_display_name_trgm_idx";

-- DropIndex
DROP INDEX "users_email_trgm_idx";

-- DropIndex
DROP INDEX "users_telegramId_idx";

-- DropIndex
DROP INDEX "users_username_trgm_idx";

-- AlterTable
ALTER TABLE "interview_sessions" ADD COLUMN     "description" VARCHAR(500),
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "title" VARCHAR(120) NOT NULL DEFAULT 'Meeting',
ADD COLUMN     "type" "InterviewSessionType" NOT NULL DEFAULT 'CODE',
ALTER COLUMN "invite_token" SET NOT NULL;

-- AlterTable
ALTER TABLE "permissions" ALTER COLUMN "slug" SET DATA TYPE VARCHAR(64),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "slug" SET DATA TYPE VARCHAR(64),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "interview_sessions_invite_token_key" ON "interview_sessions"("invite_token");

-- CreateIndex
CREATE INDEX "interview_sessions_type_status_idx" ON "interview_sessions"("type", "status");

-- CreateIndex
CREATE INDEX "notifications_category_idx" ON "notifications"("category");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt" DESC);
