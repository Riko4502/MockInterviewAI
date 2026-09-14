-- CreateTable: roles
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "permissions" BIGINT NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "roles_permissions_check" CHECK ("permissions" >= 0)
);

-- CreateTable: permissions dictionary
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "bitValue" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "permissions_bit_value_check" CHECK ("bitValue" >= 0)
);

-- AlterTable: users add roleId
ALTER TABLE "users" ADD COLUMN "roleId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "roles_slug_key" ON "roles"("slug");
CREATE INDEX "roles_slug_idx" ON "roles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_slug_key" ON "permissions"("slug");
CREATE INDEX "permissions_slug_idx" ON "permissions"("slug");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default system roles: ADMIN (bit 1 = ADMINISTRATOR), USER (bit 0 = NONE)
INSERT INTO "roles" ("id", "slug", "name", "description", "permissions", "isSystem", "createdAt", "updatedAt")
VALUES
    ('00000000-0000-4000-a000-000000000001', 'ADMIN', 'Администратор', 'Системный администратор платформы', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('00000000-0000-4000-a000-000000000002', 'USER', 'Пользователь', 'Обычный пользователь платформы', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
    "permissions" = EXCLUDED."permissions",
    "name" = EXCLUDED."name",
    "isSystem" = EXCLUDED."isSystem";

-- Seed default permissions dictionary
INSERT INTO "permissions" ("id", "slug", "name", "description", "bitValue")
VALUES
    ('00000000-0000-4000-b000-000000000001', 'administrator', 'Полный доступ (Администратор)', 'Суперпользователь платформы', 1),
    ('00000000-0000-4000-b000-000000000002', 'users:read', 'Просмотр пользователей', 'Просмотр списка и профилей пользователей', 2),
    ('00000000-0000-4000-b000-000000000003', 'users:manage', 'Управление пользователями', 'Редактирование и блокировка пользователей', 4),
    ('00000000-0000-4000-b000-000000000004', 'roles:manage', 'Управление ролями', 'Создание и редактирование ролей и прав', 8),
    ('00000000-0000-4000-b000-000000000005', 'sessions:manage', 'Управление сессиями', 'Управление сессиями интервью', 16),
    ('00000000-0000-4000-b000-000000000006', 'analytics:read', 'Просмотр аналитики', 'Доступ к метрикам и отчетам', 32)
ON CONFLICT ("slug") DO UPDATE SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "bitValue" = EXCLUDED."bitValue";

-- Assign default USER role to all existing users without a role
UPDATE "users"
SET "roleId" = '00000000-0000-4000-a000-000000000002'
WHERE "roleId" IS NULL;
