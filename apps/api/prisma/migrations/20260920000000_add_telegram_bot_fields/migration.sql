-- AlterTable: users — добавление полей привязки Telegram-чата (§9 TELEGRAM_BOT_ARCHITECTURE.md)
ALTER TABLE "users" ADD COLUMN     "telegramChatId" TEXT,
ADD COLUMN     "telegramLocale" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramChatId_key" ON "users"("telegramChatId");