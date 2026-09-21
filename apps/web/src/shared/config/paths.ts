export const paths = {
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",
  sandbox: "/dashboard/sandbox",
  notifications: "/dashboard/notifications",
  interviews: "/dashboard/interviews",
  partners: "/dashboard/partners",
  statistics: "/dashboard/statistics",
  resources: "/dashboard/resources",
  profile: "/dashboard/profile",
  forgotPassword: "/forgot-password",
} as const;

export const ROUTES = paths;

export type AppPath = (typeof paths)[keyof typeof paths];
