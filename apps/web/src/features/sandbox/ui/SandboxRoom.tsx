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

  const routerRef = useRef(router);
  routerRef.current = router;

  const onSessionReadyRef = useRef(onSessionReady);
  onSessionReadyRef.current = onSessionReady;

  const createSession = useCallback(async () => {
    setStatus("initializing");
    setErrorMessage(null);

    try {
      const res = await sessionsControllerCreateSession();
      if (res?.sessionId) {
        setRoomId(res.sessionId);
        setRole("INTERVIEWER");
        if (res.inviteToken) {
          setInviteToken(res.inviteToken);
        }
        setStatus("joined");

        const params = new URLSearchParams(searchParams.toString());
        params.set("room", res.sessionId);
        params.delete("invite");
        routerRef.current.replace(`${pathname}?${params.toString()}`);

        onSessionReadyRef.current?.(res.sessionId, "INTERVIEWER");
      }
    } catch (err) {
      console.error("[SandboxRoom] Failed to create session:", err);
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : t("sandbox.createError"),
      );
    }
  }, [pathname, searchParams, t]);

  const joinSession = useCallback(
    async (roomParam: string, inviteParam?: string) => {
      setStatus("initializing");
      setErrorMessage(null);

      try {
        const res = await sessionsControllerJoinSession(roomParam, {
          inviteToken: inviteParam || undefined,
        });
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
        console.error("[SandboxRoom] Failed to join session:", err);
        setStatus("error");
        setErrorMessage(
          err instanceof Error ? err.message : t("sandbox.joinError"),
        );
      }
    },
    [t],
  );

  // Инициализация / Join Flow
  useEffect(() => {
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
      joinSession(roomParam, inviteParam ?? undefined);
    } else {
      createSession();
    }
  }, [searchParams, joinSession, createSession, pathname]);

  const handleCreateNewSession = useCallback(() => {
    setRoomId(null);
    setInviteToken(null);
    createSession();
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
