import { createContext } from "react";
import type { SessionStatus } from "./constants";

export interface SessionContextValue {
  status: SessionStatus;
  isAuthenticated: boolean;
  startSession: (accessToken: string) => void;
  clearSession: () => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
