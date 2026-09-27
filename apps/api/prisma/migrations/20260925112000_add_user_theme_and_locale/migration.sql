-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "theme" "ThemePreference" NOT NULL DEFAULT 'DARK';
ALTER TABLE "users" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'ru';
