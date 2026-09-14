-- CreateTable: auth_revocation_tasks
CREATE TABLE "auth_revocation_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_revocation_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_revocation_tasks_userId_idx" ON "auth_revocation_tasks"("userId");
CREATE INDEX "auth_revocation_tasks_createdAt_idx" ON "auth_revocation_tasks"("createdAt");

-- AddForeignKey
ALTER TABLE "auth_revocation_tasks" ADD CONSTRAINT "auth_revocation_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
