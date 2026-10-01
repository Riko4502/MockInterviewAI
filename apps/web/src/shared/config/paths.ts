export const paths = {
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",
  adminUsers: "/admin/users",
  forbidden: "/forbidden",
  sandbox: "/dashboard/sandbox",
  notifications: "/dashboard/notifications",
  interviews: "/dashboard/interviews",
  partners: "/dashboard/partners",
  partnersMy: "/dashboard/partners/my",
  partnersNew: "/dashboard/partners/new",
  partnersRequests: "/dashboard/partners/requests",
  statistics: "/dashboard/statistics",
  resources: "/dashboard/resources",
  profile: "/dashboard/profile",
  forgotPassword: "/forgot-password",
} as const;

export const ROUTES = paths;

export type AppPath = (typeof paths)[keyof typeof paths];
