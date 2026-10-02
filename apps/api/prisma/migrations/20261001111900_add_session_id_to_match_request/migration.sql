-- AlterTable
ALTER TABLE "match_requests" ADD COLUMN "session_id" UUID;

-- CreateIndex
CREATE INDEX "match_requests_session_id_idx" ON "match_requests"("session_id");

-- AddForeignKey
ALTER TABLE "match_requests" ADD CONSTRAINT "match_requests_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
