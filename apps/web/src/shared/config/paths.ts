export const paths = {
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",
  completeTelegram: "/register/complete-telegram",
  adminUsers: "/admin/users",
  forbidden: "/forbidden",
  sandbox: "/dashboard/sandbox",
  notifications: "/dashboard/notifications",
  interviews: "/dashboard/interviews",
  partners: "/dashboard/partners",
  statistics: "/dashboard/statistics",
  resources: "/dashboard/resources",
  profile: "/profile",
  forgotPassword: "/forgot-password",
} as const;

export const ROUTES = paths;

export type AppPath = (typeof paths)[keyof typeof paths];
