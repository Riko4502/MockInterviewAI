-- CreateEnum
CREATE TYPE "InterviewSessionStatus" AS ENUM ('CREATED', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "InterviewParticipantRole" AS ENUM ('CANDIDATE', 'INTERVIEWER', 'OBSERVER');

-- CreateTable
CREATE TABLE "interview_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "InterviewSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_participants" (
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "InterviewParticipantRole" NOT NULL,

    CONSTRAINT "interview_participants_pkey" PRIMARY KEY ("sessionId","userId")
);

-- AddForeignKey
ALTER TABLE "interview_participants" ADD CONSTRAINT "interview_participants_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
