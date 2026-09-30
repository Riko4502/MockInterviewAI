import type { UserRole } from "@packages/types";
import { createContext } from "react";
import type { SessionStatus } from "./constants";

export interface SessionContextValue {
  userId: string | null;
  role: UserRole | null;
  permissions: bigint;
  status: SessionStatus;
  isAuthenticated: boolean;
  isProfileLoading: boolean;
  startSession: (accessToken: string) => void;
  clearSession: () => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
