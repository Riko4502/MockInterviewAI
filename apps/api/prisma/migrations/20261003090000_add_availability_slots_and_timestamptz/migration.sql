-- Слоты доступности, связь заявки со слотом и сессией, перевод timestamp-колонок в timestamptz (ADR-002:60-62, :125).
--
-- Всё в одной миграции, а не в двух, по практической причине: слоты по ADR-002:60
-- хранят UTC-инстанты, то есть требуют timestamptz. Если создать таблицу со
-- старым типом, а конвертовать её следующей миграцией, ограничение
-- непересечения придётся строить по выражению `starts_at + duration` — оно
-- STABLE, индекс его отвергает (см. ниже). Порядок «сначала timestamptz, потом
-- слоты» не избегает этой проблемы, только откладывает её, поэтому
-- целевая схема применяется целиком.

-- Prisma пишет значения DateTime в timestamp-без-зоны как UTC-инстанты
-- (ADR-002:54), но ALTER TYPE ... TYPE timestamptz интерпретирует имеющиеся
-- значения в зоне сессии. Без явной фиксации зоны конвертация сдвинула бы
-- данные на величину смещения сервера БД, и миграция была бы обратимой только
-- вместе с потерей времени событий. SET LOCAL действует в пределах транзакции
-- миграции, поэтому настройка не утекает за её пределы.
SET LOCAL TIME ZONE 'UTC';

-- CreateEnum
CREATE TYPE "AvailabilitySlotStatus" AS ENUM ('OPEN', 'BOOKED', 'CANCELLED');

-- AlterTable
ALTER TABLE "auth_revocation_tasks" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "interview_sessions" ADD COLUMN     "scheduled_at" TIMESTAMPTZ(3),
ALTER COLUMN "startedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "endedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "match_requests" ADD COLUMN     "session_id" UUID,
ADD COLUMN     "slot_id" UUID,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "notification_outbox" ALTER COLUMN "nextAttemptAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "processedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "readAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "permissions" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "showcase_cards" ALTER COLUMN "bumped_at" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "user_device_settings" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "deactivatedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "firstLoginAt" SET DATA TYPE TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "availability_slots" (
    "id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "AvailabilitySlotStatus" NOT NULL DEFAULT 'OPEN',
    "booked_by_request_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

-- ends_at вычисляет приложение, а эта проверка не даёт ему разъехаться с
-- duration_minutes. Интервал состоит только из минут, поэтому сложение
-- timestamptz и interval даёт абсолютное время и не зависит от зоны сессии.
ALTER TABLE "availability_slots"
    ADD CONSTRAINT "availability_slots_duration_matches_ends_at"
    CHECK ("ends_at" = "starts_at" + "duration_minutes" * INTERVAL '1 minute');

-- Непересечение слотов одной карточки обеспечивается на уровне БД (ADR-002:60, :74).
--
-- Prisma не умеет описать выражение с tstzrange, поэтому ограничение живёт
-- здесь, а схема ссылается на него в комментарии. Приложение проверяет
-- пересечения само (ADR-002:65); это страховка от гонок, которые приложение не
-- поймало, а не основной механизм: текст ошибки Prisma на таком ограничении
-- нечитаем, поэтому пересечение на уровне приложения остаётся первым.
--
-- Диапазон строится по двум готовым инстантам, а не по выражению
-- `starts_at + duration`: сложение timestamptz с interval имеет класс STABLE
-- (зависит от зоны сессии), а индекс требует IMMUTABLE — такая миграция падает
-- с "functions in index expression must be marked IMMUTABLE". Именно поэтому в
-- таблице есть ends_at.
--
-- Верхняя граница включительно задаёт полуоткрытый интервал
-- [starts_at, ends_at): слоты 19:00-20:00 и 20:00-21:00 граничат, но не
-- пересекаются, и оба остаются доступными.
--
-- CANCELLED исключён из ограничения: погашенный слот не должен мешать
-- поставить новый на его время, иначе пересборка расписания после снятия
-- слота была бы невозможна.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "availability_slots"
    ADD CONSTRAINT "availability_slots_no_overlap_per_card"
    EXCLUDE USING GIST (
        "card_id" WITH =,
        tstzrange("starts_at", "ends_at") WITH &&
    )
    WHERE ("status" <> 'CANCELLED');

-- CreateIndex
CREATE INDEX "availability_slots_card_id_status_idx" ON "availability_slots"("card_id", "status");

-- CreateIndex
CREATE INDEX "availability_slots_card_id_starts_at_idx" ON "availability_slots"("card_id", "starts_at");

-- CreateIndex
CREATE INDEX "availability_slots_booked_by_request_id_idx" ON "availability_slots"("booked_by_request_id");

-- CreateIndex
CREATE INDEX "interview_sessions_scheduled_at_idx" ON "interview_sessions"("scheduled_at");

-- Уникальность нужна, чтобы сессия принадлежала ровно одной заявке: повторное
-- принятие заявки не должно создавать вторую встречу (ADR-002:62).
CREATE UNIQUE INDEX "match_requests_session_id_key" ON "match_requests"("session_id");

-- AddForeignKey
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "showcase_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL, а не CASCADE: удаление слота не должно удалять заявку, к которой он
-- относится, иначе отмена расписания стирала бы историю откликов.
ALTER TABLE "match_requests" ADD CONSTRAINT "match_requests_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "availability_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "match_requests" ADD CONSTRAINT "match_requests_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Трингамные индексы users_*_trgm_idx намеренно не удаляются. Prisma их не
-- описывает (в схеме их нет), поэтому `migrate diff` предлагает их DROP; они
-- созданы вручную в миграции для поиска по email/username/displayName, и их
-- удаление вернуло бы полнотекстовый поиск к LIKE-сканированию таблицы.