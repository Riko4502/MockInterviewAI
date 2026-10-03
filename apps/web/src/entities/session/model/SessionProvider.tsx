"use client";

import {
  getProfileControllerGetMyProfileQueryKey,
  useProfileControllerGetMyProfile,
} from "@packages/api";
import { defaultLocale, getMessages, type Locale } from "@packages/i18n";
import { SystemPermission } from "@packages/types";
import { AppPreloader } from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import {
  authToken,
  RefreshSessionError,
  refreshAccessToken,
} from "@/shared/api";
import { decodeJwtPayload } from "../lib/decodeJwtPayload";
import { SESSION_STATUS, type SessionStatus } from "./constants";
import { SessionContext } from "./context";

export interface SessionProviderProps extends PropsWithChildren {
  initialLocale?: Locale;
  minDuration?: number;
  fadeDuration?: number;
  oncePerSession?: boolean;
}

export function SessionProvider({
  children,
  initialLocale,
  minDuration: customMinDuration,
  fadeDuration: customFadeDuration,
  oncePerSession: customOncePerSession,
}: SessionProviderProps) {
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

  const { i18n } = useTranslation();
  const currentLocale =
    initialLocale ?? ((i18n.language as Locale) || defaultLocale);
  const t = getMessages(currentLocale).common.loading;

  const isReady = status !== SESSION_STATUS.INITIALIZING;
  const isTest = process.env.NODE_ENV === "test";
  const minDuration = customMinDuration ?? (isTest ? 0 : 400);
  const fadeDuration = customFadeDuration ?? (isTest ? 0 : 300);
  const shouldBeOncePerSession = customOncePerSession ?? !isTest;

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
      <AppPreloader
        isReady={isReady}
        minDuration={minDuration}
        fadeDuration={fadeDuration}
        oncePerSession={shouldBeOncePerSession && isReady}
        title={t.title}
        badgeText={t.badges.sync}
        description={t.descriptions.sessionRestore}
        steps={t.steps.sessionRestore}
        systemActiveText={t.systemActive}
        brandLabel={t.brandLabel}
      >
        {isReady ? children : null}
      </AppPreloader>
    </SessionContext.Provider>
  );
}
