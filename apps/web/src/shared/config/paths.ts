export const paths = {
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",
  interviews: "/dashboard/interviews",
  partners: "/dashboard/partners",
  statistics: "/dashboard/statistics",
  resources: "/dashboard/resources",
} as const;

export const ROUTES = paths;

export type AppPath = (typeof paths)[keyof typeof paths];
