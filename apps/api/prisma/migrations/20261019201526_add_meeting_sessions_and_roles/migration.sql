-- CreateEnum
CREATE TYPE "InterviewSessionType" AS ENUM ('CODE', 'MEETING');

-- AlterEnum
ALTER TYPE "InterviewParticipantRole" ADD VALUE 'HOST';
ALTER TYPE "InterviewParticipantRole" ADD VALUE 'PARTICIPANT';

-- AlterTable
ALTER TABLE "interview_sessions" ADD COLUMN     "description" VARCHAR(500),
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "title" VARCHAR(120) NOT NULL DEFAULT 'Meeting',
ADD COLUMN     "type" "InterviewSessionType" NOT NULL DEFAULT 'CODE';

-- CreateIndex
CREATE UNIQUE INDEX "interview_sessions_invite_token_key" ON "interview_sessions"("invite_token");

-- CreateIndex
CREATE INDEX "interview_sessions_type_status_idx" ON "interview_sessions"("type", "status");
