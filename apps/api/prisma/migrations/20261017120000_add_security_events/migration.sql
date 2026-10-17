-- CreateEnum
-- Фиксированное перечисление типов security-событий (ADR-005:93).
CREATE TYPE "SecurityEventType" AS ENUM ('ACCOUNT_REGISTERED', 'FIRST_LOGIN', 'PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'LOGIN_FROM_NEW_DEVICE', 'TG_LINKED', 'TG_UNLINKED', 'GITHUB_LINKED', 'GITHUB_UNLINKED', 'PROFILE_CHANGED', 'ACCOUNT_DEACTIVATED', 'ACCOUNT_RESTORED');

-- CreateTable
-- Аудит событий безопасности (ADR-005:92) + состояние доставки (plan D7).
-- `notified_at`/`seen_at`/`attempts` заменяют отдельную outbox-таблицу:
-- security-события не смешиваются с `notifications` (ADR-005:74).
CREATE TABLE "security_events" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "SecurityEventType" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "notified_at" TIMESTAMPTZ(3),
    "delivery_skipped_at" TIMESTAMPTZ(3),
    "seen_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_events_userId_seen_at_idx" ON "security_events"("userId", "seen_at");

-- CreateIndex
CREATE INDEX "security_events_notified_at_next_attempt_at_idx" ON "security_events"("notified_at", "next_attempt_at");

-- CreateIndex
CREATE INDEX "security_events_createdAt_idx" ON "security_events"("createdAt");

-- AddForeignKey
-- ON DELETE RESTRICT, а не CASCADE (plan D12): событие переживает soft-delete
-- (`User.deletedAt`) и удаляется только при окончательном затирании аккаунта
-- (ADR-005:125, :127) — `user-cleanup.cron.ts` сносит события до пользователя.
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
