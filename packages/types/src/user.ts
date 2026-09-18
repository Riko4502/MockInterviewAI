/**
 * Статус активности пользователя.
 */
export const UserStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

/**
 * Административное представление пользователя (без passwordHash).
 */
export interface UserAdminView {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  role: string;
  isActive: boolean;
  deactivatedAt: string | null;
  deletedAt: string | null;
  avatarUrl: string | null;
  telegramUsername: string | null;
  gitUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Детальное административное представление пользователя со статистикой.
 */
export interface UserAdminDetailView extends UserAdminView {
  sessionsCount: number;
  participationsCount: number;
}
