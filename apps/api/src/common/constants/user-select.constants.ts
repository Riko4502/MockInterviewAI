/**
 * Безопасный селектор полей пользователя для административной панели.
 *
 * Строго исключает `passwordHash` на уровне запроса к базе данных Prisma.
 */
export const USER_ADMIN_SELECT = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  isActive: true,
  deactivatedAt: true,
  deletedAt: true,
  avatarUrl: true,
  telegramUsername: true,
  gitUrl: true,
  createdAt: true,
  updatedAt: true,
  role: {
    select: {
      id: true,
      slug: true,
      name: true,
      permissions: true,
    },
  },
} as const;
