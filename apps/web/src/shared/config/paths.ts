export const paths = {
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",
  notifications: "/dashboard/notifications",
  interviews: "/dashboard/interviews",
  partners: "/dashboard/partners",
  statistics: "/dashboard/statistics",
  resources: "/dashboard/resources",
  profile: "/dashboard/profile",
} as const;

export const ROUTES = paths;

export type AppPath = (typeof paths)[keyof typeof paths];
