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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const routerRef = useRef(router);
  routerRef.current = router;

  const onSessionReadyRef = useRef(onSessionReady);
  onSessionReadyRef.current = onSessionReady;

  // Инициализация / Join Flow
  useEffect(() => {
    let cancelled = false;

    const token = authToken.get();
    if (!token) {
      return;
    }

    const roomParam = searchParams.get("room");

    if (roomParam && isValidUUID(roomParam)) {
      setStatus("initializing");

      sessionsControllerJoinSession(roomParam)
        .then((res) => {
          if (cancelled) return;
          setRoomId(roomParam);
          setRole(res.role);
          setStatus("joined");
          onSessionReadyRef.current?.(roomParam, res.role);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error("[SandboxRoom] Failed to join session:", err);
          setStatus("error");
          setErrorMessage(
            err instanceof Error ? err.message : t("sandbox.joinError"),
          );
        });
    } else {
      setStatus("initializing");

      sessionsControllerCreateSession()
        .then((res) => {
          if (cancelled) return;
          if (res?.sessionId) {
            setRoomId(res.sessionId);
            setRole("INTERVIEWER");
            setStatus("joined");

            const params = new URLSearchParams(searchParams.toString());
            params.set("room", res.sessionId);
            routerRef.current.replace(`${pathname}?${params.toString()}`);

            onSessionReadyRef.current?.(res.sessionId, "INTERVIEWER");
          }
        })
        .catch((err) => {
          if (cancelled) return;
          console.error("[SandboxRoom] Failed to create session:", err);
          setStatus("error");
          setErrorMessage(
            err instanceof Error ? err.message : t("sandbox.createError"),
          );
        });
    }

    return () => {
      cancelled = true;
    };
  }, [searchParams, pathname, t]);

  const handleCreateNewSession = useCallback(() => {
    setStatus("idle");
    setRoomId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("room");
    routerRef.current.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, pathname]);

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
    <SandboxRoomWorkspace roomId={roomId} role={role} pathname={pathname} />
  );
}
