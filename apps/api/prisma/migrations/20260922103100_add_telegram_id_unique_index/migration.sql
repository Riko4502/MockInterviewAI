-- CreateIndex
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "users_telegramId_key" ON "users"("telegramId");
