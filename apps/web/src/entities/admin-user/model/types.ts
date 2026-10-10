import type {
  UserAdminDetailResponseDto,
  UserAdminResponseDto,
} from "@packages/dto";
import type { SystemRole } from "@packages/types";

export type AdminUser = UserAdminResponseDto;
export type AdminUserDetail = UserAdminDetailResponseDto;

export type AdminUsersSortableField =
  | "username"
  | "email"
  | "role"
  | "createdAt";
export type AdminUsersSortOrder = "asc" | "desc";

export interface AdminUsersFilterParams {
  page: number;
  limit: number;
  search?: string;
  role?: SystemRole;
  isActive?: boolean;
  sortBy?: AdminUsersSortableField;
  sortOrder?: AdminUsersSortOrder;
}
