export const SESSION_STATUS = {
  INITIALIZING: "initializing",
  AUTHENTICATED: "authenticated",
  UNAUTHENTICATED: "unauthenticated",
  ERROR: "error",
} as const;

export type SessionStatus =
  (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];
