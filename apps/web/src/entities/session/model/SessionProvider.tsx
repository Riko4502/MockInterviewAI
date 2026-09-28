"use client";

import { defaultLocale, getMessages, type Locale } from "@packages/i18n";
import { AppPreloader } from "@packages/ui";
import "@/shared/lib/i18n";
import { type PropsWithChildren, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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

  const { i18n } = useTranslation();
  const currentLocale = (i18n.language as Locale) || defaultLocale;
  const t = getMessages(currentLocale).common.loading;

  const isReady = status !== SESSION_STATUS.INITIALIZING;
  const isTest = process.env.NODE_ENV === "test";
  const minDuration = isTest ? 0 : 2200;
  const fadeDuration = isTest ? 0 : 600;

  return (
    <SessionContext.Provider
      value={{
        status,
        isAuthenticated: status === SESSION_STATUS.AUTHENTICATED,
        startSession,
        clearSession,
      }}
    >
      <AppPreloader
        isReady={isReady}
        minDuration={minDuration}
        fadeDuration={fadeDuration}
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
