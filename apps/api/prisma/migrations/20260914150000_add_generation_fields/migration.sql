-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "auth_revocation_tasks"
  ADD COLUMN "generation" INTEGER;
