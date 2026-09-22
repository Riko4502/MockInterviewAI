-- CreateEnum
CREATE TYPE "Specialization" AS ENUM ('FRONTEND', 'BACKEND', 'FULLSTACK', 'DEVOPS', 'QA', 'MOBILE', 'DATA_ML', 'SYSTEM_DESIGN');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('JUNIOR', 'MIDDLE', 'SENIOR', 'LEAD');

-- CreateEnum
CREATE TYPE "InterviewLanguage" AS ENUM ('RU', 'EN', 'ANY');

-- CreateEnum
CREATE TYPE "ShowcaseCardStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MatchRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "showcase_cards" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(100),
    "specialization" "Specialization" NOT NULL,
    "level" "ExperienceLevel" NOT NULL,
    "language" "InterviewLanguage" NOT NULL DEFAULT 'RU',
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bio" VARCHAR(500),
    "schedule_info" VARCHAR(300),
    "is_urgent" BOOLEAN NOT NULL DEFAULT false,
    "status" "ShowcaseCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "bumped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "showcase_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_requests" (
    "id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "receiver_id" UUID NOT NULL,
    "target_card_id" UUID NOT NULL,
    "sender_card_id" UUID,
    "status" "MatchRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" VARCHAR(300),
    "preferred_topic" VARCHAR(100),
    "reject_reason" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "showcase_cards_specialization_level_idx" ON "showcase_cards"("specialization", "level");

-- CreateIndex
CREATE INDEX "showcase_cards_language_idx" ON "showcase_cards"("language");

-- CreateIndex
CREATE INDEX "showcase_cards_status_idx" ON "showcase_cards"("status");

-- CreateIndex
CREATE INDEX "showcase_cards_is_urgent_idx" ON "showcase_cards"("is_urgent");

-- CreateIndex
CREATE INDEX "showcase_cards_user_id_status_idx" ON "showcase_cards"("user_id", "status");

-- CreateIndex
CREATE INDEX "showcase_cards_status_expires_at_idx" ON "showcase_cards"("status", "expires_at");

-- CreateIndex
CREATE INDEX "showcase_cards_bumped_at_idx" ON "showcase_cards"("bumped_at" DESC);

-- CreateIndex
CREATE INDEX "showcase_cards_skills_idx" ON "showcase_cards" USING GIN ("skills");

-- CreateIndex
CREATE INDEX "match_requests_receiver_id_status_idx" ON "match_requests"("receiver_id", "status");

-- CreateIndex
CREATE INDEX "match_requests_sender_id_status_idx" ON "match_requests"("sender_id", "status");

-- CreateIndex
CREATE INDEX "match_requests_target_card_id_status_idx" ON "match_requests"("target_card_id", "status");

-- CreateIndex
CREATE INDEX "match_requests_status_expires_at_idx" ON "match_requests"("status", "expires_at");

-- AddForeignKey
ALTER TABLE "showcase_cards" ADD CONSTRAINT "showcase_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_requests" ADD CONSTRAINT "match_requests_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_requests" ADD CONSTRAINT "match_requests_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_requests" ADD CONSTRAINT "match_requests_target_card_id_fkey" FOREIGN KEY ("target_card_id") REFERENCES "showcase_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_requests" ADD CONSTRAINT "match_requests_sender_card_id_fkey" FOREIGN KEY ("sender_card_id") REFERENCES "showcase_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Частичные уникальные индексы (не поддерживаются в Prisma schema)

-- Запрет дубликатов активных заявок от одного пользователя на одну карточку
CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_match_request_per_card
  ON match_requests (sender_id, target_card_id)
  WHERE status = 'PENDING';

-- Запрет дублирования активных карточек с одинаковой специализацией и грейдом
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_user_specialization_level
  ON showcase_cards (user_id, specialization, level)
  WHERE status = 'ACTIVE';
