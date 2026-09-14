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
  deactivatedAt: Date | string | null;
  avatarUrl: string | null;
  telegramUsername: string | null;
  gitUrl: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Детальное административное представление пользователя со статистикой.
 */
export interface UserAdminDetailView extends UserAdminView {
  sessionsCount: number;
  participationsCount: number;
}
