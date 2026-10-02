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
  partnersMy: "/dashboard/partners/my",
  partnersNew: "/dashboard/partners/new",
  partnersEdit: (id: string) => `/dashboard/partners/${id}/edit`,
  partnersRequests: "/dashboard/partners/requests",
  statistics: "/dashboard/statistics",
  resources: "/dashboard/resources",
  profile: "/profile",
  forgotPassword: "/forgot-password",
} as const;

export const ROUTES = paths;

export type AppPath = (typeof paths)[keyof typeof paths];
