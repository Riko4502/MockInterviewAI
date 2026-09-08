"use client";

import { type PropsWithChildren, useEffect, useState } from "react";
import {
  authToken,
  RefreshSessionError,
  refreshAccessToken,
} from "@/shared/api";
import { SESSION_STATUS, type SessionStatus } from "./constants";
import { SessionContext } from "./context";

export function SessionProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SessionStatus>(
    SESSION_STATUS.INITIALIZING,
  );

  useEffect(() => {
    async function restoreSession() {
      try {
        await refreshAccessToken();

        setStatus(SESSION_STATUS.AUTHENTICATED);
      } catch (error) {
        if (
          error instanceof RefreshSessionError &&
          (error.status === 401 || error.status === 403)
        ) {
          setStatus(SESSION_STATUS.UNAUTHENTICATED);
          return;
        }

        setStatus(SESSION_STATUS.ERROR);
      }
    }

    void restoreSession();
  }, []);

  const startSession = (accessToken: string) => {
    authToken.set(accessToken);
    setStatus(SESSION_STATUS.AUTHENTICATED);
  };

  const clearSession = () => {
    authToken.clear();
    setStatus(SESSION_STATUS.UNAUTHENTICATED);
  };

  if (status === SESSION_STATUS.INITIALIZING) {
    return null;
  }

  return (
    <SessionContext.Provider
      value={{
        status,
        isAuthenticated: status === SESSION_STATUS.AUTHENTICATED,
        startSession,
        clearSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
