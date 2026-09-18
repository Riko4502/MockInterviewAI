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
        if (res.inviteToken) {
          params.set("invite", res.inviteToken);
        }
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
    const inviteParam = searchParams.get("invite");

    if (roomParam && isValidUUID(roomParam)) {
      joinSession(roomParam, inviteParam ?? undefined);
    } else {
      createSession();
    }
  }, [searchParams, joinSession, createSession]);

  const handleCreateNewSession = useCallback(() => {
    setRoomId(null);
    setInviteToken(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("room");
    params.delete("invite");
    routerRef.current.replace(`${pathname}?${params.toString()}`);
    createSession();
  }, [searchParams, pathname, createSession]);

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
