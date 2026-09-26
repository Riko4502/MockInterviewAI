-- AlterTable
ALTER TABLE "users" ADD COLUMN     "githubId" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_githubId_key" ON "users"("githubId");

-- CreateIndex
CREATE INDEX "users_githubId_idx" ON "users"("githubId");
