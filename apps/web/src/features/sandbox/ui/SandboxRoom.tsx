"use client";

import {
  sessionsControllerCreateSession,
  sessionsControllerJoinSession,
} from "@packages/api";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { validate as isValidUUID } from "uuid";
import { authToken } from "@/shared/api";
import "@/shared/lib/i18n";
import { SandboxRoomError } from "./SandboxRoomError";
import { SandboxRoomLoading } from "./SandboxRoomLoading";
import { SandboxRoomWorkspace } from "./SandboxRoomWorkspace";

export type SessionStatus = "idle" | "initializing" | "joined" | "error";

export interface SandboxRoomProps {
  onSessionReady?: (sessionId: string, role: string) => void;
}

export function SandboxRoom({ onSessionReady }: SandboxRoomProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation("interview");

  const [status, setStatus] = useState<SessionStatus>("idle");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const skipNextJoinRef = useRef<string | null>(null);

  const routerRef = useRef(router);
  routerRef.current = router;

  const onSessionReadyRef = useRef(onSessionReady);
  onSessionReadyRef.current = onSessionReady;

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const createSession = useCallback(
    async (isCancelled?: () => boolean) => {
      setStatus("initializing");
      setErrorMessage(null);

      try {
        const res = await sessionsControllerCreateSession();
        if (isCancelled?.() || !isMountedRef.current) {
          return;
        }

        if (res?.sessionId) {
          setRoomId(res.sessionId);
          setRole("INTERVIEWER");
          if (res.inviteToken) {
            setInviteToken(res.inviteToken);
          }
          setStatus("joined");

          skipNextJoinRef.current = res.sessionId;
          const params = new URLSearchParams(searchParams.toString());
          params.set("room", res.sessionId);
          params.delete("invite");
          routerRef.current.replace(`${pathname}?${params.toString()}`);

          onSessionReadyRef.current?.(res.sessionId, "INTERVIEWER");
        }
      } catch (err) {
        if (isCancelled?.() || !isMountedRef.current) {
          return;
        }

        console.error("[SandboxRoom] Failed to create session:", err);
        setStatus("error");
        setErrorMessage(t("sandbox.createError"));
      }
    },
    [pathname, searchParams, t],
  );

  const joinSession = useCallback(
    async (
      roomParam: string,
      inviteParam?: string,
      isCancelled?: () => boolean,
    ) => {
      setStatus("initializing");
      setErrorMessage(null);

      try {
        const res = await sessionsControllerJoinSession(roomParam, {
          inviteToken: inviteParam || undefined,
        });
        if (isCancelled?.() || !isMountedRef.current) {
          return;
        }

        setRoomId(roomParam);
        setRole(res.role);
        if (res.inviteToken) {
          setInviteToken(res.inviteToken);
        } else if (inviteParam) {
          setInviteToken(inviteParam);
        }
        setStatus("joined");
        onSessionReadyRef.current?.(roomParam, res.role);
      } catch (err) {
        if (isCancelled?.() || !isMountedRef.current) {
          return;
        }

        console.error("[SandboxRoom] Failed to join session:", err);
        setStatus("error");
        setErrorMessage(t("sandbox.joinError"));
      }
    },
    [t],
  );

  // Инициализация / Join Flow
  useEffect(() => {
    let cancelled = false;

    const token = authToken.get();
    if (!token) {
      return;
    }

    const roomParam = searchParams.get("room");

    // Читаем инвайт сначала из URI-фрагмента (#invite=...), затем fallback на searchParams
    let inviteParam: string | null = null;
    if (typeof window !== "undefined" && window.location.hash) {
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, ""),
      );
      inviteParam = hashParams.get("invite");
    }
    if (!inviteParam) {
      inviteParam = searchParams.get("invite");
    }

    // Немедленно вычищаем чувствительный invite-токен из URL и истории браузера (CWE-598)
    if (
      typeof window !== "undefined" &&
      (searchParams.has("invite") || window.location.hash?.includes("invite="))
    ) {
      const cleanParams = new URLSearchParams(searchParams.toString());
      cleanParams.delete("invite");
      const cleanQuery = cleanParams.toString()
        ? `?${cleanParams.toString()}`
        : "";
      const cleanUrl = `${pathname}${cleanQuery}`;
      window.history.replaceState(null, "", cleanUrl);
    }

    if (roomParam && isValidUUID(roomParam)) {
      if (skipNextJoinRef.current === roomParam) {
        skipNextJoinRef.current = null;
      } else {
        joinSession(roomParam, inviteParam ?? undefined, () => cancelled);
      }
    } else {
      createSession(() => cancelled);
    }

    return () => {
      cancelled = true;
    };
  }, [searchParams, joinSession, createSession, pathname]);

  const handleCreateNewSession = useCallback(() => {
    setRoomId(null);
    setInviteToken(null);
    createSession(() => !isMountedRef.current);
  }, [createSession]);

  // Error State
  if (status === "error") {
    return (
      <SandboxRoomError
        errorMessage={errorMessage}
        onCreateNewSession={handleCreateNewSession}
      />
    );
  }

  // Loading State
  if (status === "initializing" || status === "idle" || !roomId) {
    return <SandboxRoomLoading />;
  }

  // Active Workspace
  return (
    <SandboxRoomWorkspace
      roomId={roomId}
      role={role}
      pathname={pathname}
      inviteToken={inviteToken ?? undefined}
    />
  );
}
