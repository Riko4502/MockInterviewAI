"use client";

import {
  getProfileControllerGetMyProfileQueryKey,
  useProfileControllerGetMyProfile,
} from "@packages/api";
import { SystemPermission } from "@packages/types";
import { useQueryClient } from "@tanstack/react-query";
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  authToken,
  RefreshSessionError,
  refreshAccessToken,
} from "@/shared/api";
import { decodeJwtPayload } from "../lib/decodeJwtPayload";
import { SESSION_STATUS, type SessionStatus } from "./constants";
import { SessionContext } from "./context";

export function SessionProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SessionStatus>(
    SESSION_STATUS.INITIALIZING,
  );

  const queryClient = useQueryClient();
  const subscribeToToken = useCallback(
    (onStoreChange: () => void) => {
      let previousToken = authToken.get();
      return authToken.subscribe(() => {
        const nextToken = authToken.get();
        if (nextToken !== previousToken && nextToken !== null) {
          // Discard the old session's profile before rendering the new token.
          queryClient.removeQueries({
            queryKey: getProfileControllerGetMyProfileQueryKey(),
            exact: true,
          });
        }
        previousToken = nextToken;
        onStoreChange();
      });
    },
    [queryClient],
  );
  const token = useSyncExternalStore(
    subscribeToToken,
    authToken.get,
    () => null,
  );
  const payload = useMemo(
    () => (token ? decodeJwtPayload(token) : null),
    [token],
  );
  const isAuthenticated =
    status === SESSION_STATUS.AUTHENTICATED && payload !== null;
  const profile = useProfileControllerGetMyProfile({
    query: { enabled: isAuthenticated, staleTime: 0 },
  });
  const role =
    isAuthenticated && profile.data?.id === payload?.sub
      ? profile.data.role
      : null;

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const restored = await refreshAccessToken();
        if (!active) return;
        if (!decodeJwtPayload(restored)) {
          authToken.clear();
          setStatus(SESSION_STATUS.UNAUTHENTICATED);
          return;
        }
        setStatus(SESSION_STATUS.AUTHENTICATED);
      } catch (error) {
        if (!active) return;
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
    return () => {
      active = false;
    };
  }, []);

  const startSession = (accessToken: string) => {
    if (!decodeJwtPayload(accessToken)) {
      authToken.clear();
      setStatus(SESSION_STATUS.UNAUTHENTICATED);
      return;
    }
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
        status:
          status === SESSION_STATUS.AUTHENTICATED && !payload
            ? SESSION_STATUS.UNAUTHENTICATED
            : status,
        isAuthenticated,
        isProfileLoading:
          isAuthenticated && profile.isPending && !profile.isError,
        userId: isAuthenticated ? payload.sub : null,
        role,
        permissions: isAuthenticated
          ? payload.permissions
          : SystemPermission.NONE,
        startSession,
        clearSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
